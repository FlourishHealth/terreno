import * as Sentry from "@sentry/bun";
import {logger} from "@terreno/api";
import mongoose from "mongoose";
import type {ConfigurationDocument, ConfigurationModel, ConfigValueType} from "../types";
import {addDefaultPlugins} from "./modelPlugins";

/**
 * Configuration definition
 */
interface ConfigDefinition {
  envVar?: string; // Environment variable name
  defaultValue?: ConfigValueType; // Default value if not set
  type?: "string" | "number" | "boolean"; // Type for conversion
  validator?: (value: ConfigValueType) => boolean; // Optional validator function
  description?: string; // Documentation
}

/**
 * Configuration registry
 */
const configRegistry = new Map<string, ConfigDefinition>();

/**
 * Runtime configuration overrides
 */
const runtimeOverrides = new Map<string, ConfigValueType>();

/**
 * Database configuration cache
 * Maintains an always-available cached version of database config values
 */
const dbCache = new Map<string, ConfigValueType>();

/**
 * Change stream for watching configuration changes
 */
let changeStream: ReturnType<typeof ConfigurationDB.watch> | null = null;

/**
 * Flag to track if configuration has been initialized
 */
let isInitialized = false;

/**
 * Configuration class with static methods for managing application configuration
 * Singleton pattern - use static methods only, instantiation is not allowed
 */

export class Configuration {
  /**
   * Private constructor to prevent instantiation
   * This class should only be used through its static methods
   */
  private constructor() {
    throw new Error(
      "Configuration is a singleton and cannot be instantiated. Use static methods instead."
    );
  }

  /**
   * Register a configuration key with its definition
   */
  static register(key: string, definition: ConfigDefinition): void {
    configRegistry.set(key, definition);
  }

  /**
   * Get a configuration value
   * Priority: runtime override > database cache > environment variable > default value
   */
  static get<T extends ConfigValueType>(key: string, fallback?: T): T {
    // Check runtime overrides first
    if (runtimeOverrides.has(key)) {
      return runtimeOverrides.get(key) as T;
    }

    // Check database cache (second priority)
    if (dbCache.has(key)) {
      const cachedValue = dbCache.get(key);
      // Convert null to undefined for consistency
      return (cachedValue === null ? undefined : cachedValue) as T;
    }

    // Get the registered definition
    const definition = configRegistry.get(key);

    if (!definition) {
      // If not registered, check environment directly
      const envValue = process.env[key];
      if (envValue !== undefined) {
        return Configuration.convertValue(envValue, "string") as T;
      }
      return fallback as T;
    }

    // Check environment variable
    if (definition.envVar && process.env[definition.envVar] !== undefined) {
      const rawValue = process.env[definition.envVar];
      const convertedValue = Configuration.convertValue(rawValue, definition.type || "string") as T;

      // If conversion failed (returned undefined or null for invalid number), use default
      if (
        convertedValue === undefined ||
        (convertedValue === null &&
          definition.type === "number" &&
          definition.defaultValue !== undefined)
      ) {
        return (definition.defaultValue ?? fallback) as T;
      }

      // Validate if validator is provided
      if (definition.validator && !definition.validator(convertedValue)) {
        logger.warn(`Configuration validation failed for ${key}, using default value`);
        return (definition.defaultValue ?? fallback) as T;
      }

      return convertedValue;
    }

    // Return default value or fallback
    return (definition.defaultValue ?? fallback) as T;
  }

  /**
   * Set a runtime configuration value
   * @param persistToDB - If true, also saves to database (default: false)
   */
  static set<T extends ConfigValueType>(key: string, value: T, persistToDB = false): void {
    const definition = configRegistry.get(key);

    // Validate if validator is provided
    if (definition?.validator && !definition.validator(value)) {
      throw new Error(`Configuration validation failed for ${key}`);
    }

    runtimeOverrides.set(key, value);

    // Optionally persist to database
    if (persistToDB && isInitialized) {
      Configuration.setDB(key, value).catch((error: unknown) => {
        logger.error(`Failed to persist configuration ${key} to database: ${error}`);
      });
    }
  }

  /**
   * Set a configuration value in the database
   * This will automatically update the cache via change stream
   */
  static async setDB<T extends ConfigValueType>(key: string, value: T): Promise<void> {
    if (value === undefined) {
      throw new Error("Cannot set undefined value in database. Use null instead.");
    }

    const definition = configRegistry.get(key);

    // Validate if validator is provided
    if (definition?.validator && !definition.validator(value)) {
      throw new Error(`Configuration validation failed for ${key}`);
    }

    await ConfigurationDB.setValue(key, value as ConfigValueType);
  }

  /**
   * Clear a runtime override
   */
  static clear(key: string): void {
    runtimeOverrides.delete(key);
  }

  /**
   * Clear all runtime overrides
   */
  static clearAll(): void {
    runtimeOverrides.clear();
  }

  /**
   * Get all configuration keys
   */
  static getKeys(): string[] {
    return Array.from(configRegistry.keys());
  }

  /**
   * Get configuration definition
   */
  static getDefinition(key: string): ConfigDefinition | undefined {
    return configRegistry.get(key);
  }

  /**
   * Convert string value to appropriate type
   */
  private static convertValue(
    value: string | undefined,
    type: "string" | "number" | "boolean"
  ): ConfigValueType {
    if (value === undefined) {
      return null;
    }

    switch (type) {
      case "number": {
        const num = Number(value);
        return Number.isNaN(num) ? null : num;
      }
      case "boolean":
        return value.toLowerCase() === "true" || value === "1";
      default:
        return value;
    }
  }

  /**
   * Get all current configuration values (for debugging)
   */
  static getAll(): Record<string, ConfigValueType> {
    const result: Record<string, ConfigValueType> = {};
    for (const key of configRegistry.keys()) {
      result[key] = Configuration.get(key);
    }
    return result;
  }

  /**
   * Get the database cache (for debugging)
   */
  static getDBCache(): Record<string, ConfigValueType> {
    const result: Record<string, ConfigValueType> = {};
    for (const [key, value] of dbCache.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Load all configuration from database into cache
   */
  static async loadFromDB(): Promise<void> {
    try {
      const allConfigs = await ConfigurationDB.find({});
      for (const config of allConfigs) {
        dbCache.set(config.key, config.value);
      }
      logger.info(`Loaded ${allConfigs.length} configuration values from database`);
    } catch (error: unknown) {
      logger.error(`Failed to load configuration from database: ${error}`);
      throw error;
    }
  }

  /**
   * Start watching the configuration change stream
   * Returns false if change streams are not available (e.g., no replica set)
   */
  static async startWatching(): Promise<boolean> {
    if (changeStream) {
      logger.warn("Configuration change stream is already running");
      return true;
    }

    try {
      changeStream = ConfigurationDB.watch([], {
        fullDocument: "updateLookup",
      });

      changeStream.on("change", (change) => {
        try {
          if (change.operationType === "insert" || change.operationType === "update") {
            const doc = change.fullDocument as ConfigurationDocument;
            if (doc) {
              dbCache.set(doc.key, doc.value);
              logger.debug(`Configuration cache updated: ${doc.key} = ${doc.value}`);
            }
          } else if (change.operationType === "delete") {
            // Reload all configs on delete since we don't have the key directly
            Configuration.loadFromDB().catch((error: unknown) => {
              logger.error(`Failed to reload configuration after delete: ${error}`);
            });
          } else if (change.operationType === "replace") {
            const doc = change.fullDocument as ConfigurationDocument;
            if (doc) {
              dbCache.set(doc.key, doc.value);
              logger.debug(`Configuration cache replaced: ${doc.key} = ${doc.value}`);
            }
          }
        } catch (error: unknown) {
          logger.error(`Error processing configuration change: ${error}`);
        }
      });

      changeStream.on("error", (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Don't attempt to restart if replica sets aren't available
        if (errorMessage.includes("replica set")) {
          logger.warn(
            "Configuration change streams not available (replica set required). Cache will not auto-update."
          );
          Configuration.stopWatching();
          return;
        }
        logger.error(`Configuration change stream error: ${error}`);
        // Attempt to restart the stream for other errors
        Configuration.stopWatching();
        setTimeout(() => {
          Configuration.startWatching().catch((err: unknown) => {
            Sentry.captureException(err);
            logger.error(`Failed to restart configuration change stream: ${err}`);
          });
        }, 5000);
      });

      logger.info("Configuration change stream started");
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("replica set")) {
        logger.warn(
          "Configuration change streams not available (replica set required). Cache will not auto-update."
        );
        return false;
      }
      logger.error(`Failed to start configuration change stream: ${error}`);
      return false;
    }
  }

  /**
   * Stop watching the configuration change stream
   */
  static stopWatching(): void {
    if (changeStream) {
      changeStream.close().catch((error: unknown) => {
        logger.error(`Error closing configuration change stream: ${error}`);
      });
      changeStream = null;
      logger.info("Configuration change stream stopped");
    }
  }

  /**
   * Check if change streams are currently available
   */
  static isChangeStreamAvailable(): boolean {
    return changeStream !== null;
  }

  /**
   * Initialize the configuration system with database support
   */
  static async initialize(): Promise<void> {
    if (isInitialized) {
      logger.warn("Configuration already initialized");
      return;
    }

    try {
      // Load existing configuration from database
      await Configuration.loadFromDB();

      // Start watching for changes (may fail if replica set not available)
      const changeStreamAvailable = await Configuration.startWatching();
      if (!changeStreamAvailable) {
        logger.info("Configuration system initialized (change streams not available)");
      } else {
        logger.info("Configuration system initialized with database support");
      }

      isInitialized = true;
    } catch (error: unknown) {
      logger.error(`Failed to initialize configuration system: ${error}`);
      throw error;
    }
  }

  /**
   * Shutdown the configuration system
   */
  static async shutdown(): Promise<void> {
    Configuration.stopWatching();
    dbCache.clear();
    isInitialized = false;
    logger.info("Configuration system shutdown");
  }
}

/**
 * Initialize configuration with database support
 * This should be called after MongoDB connection is established
 */
export const initConfiguration = async (): Promise<void> => {
  if (isInitialized) {
    logger.warn("Configuration already initialized");
    return;
  }
  try {
    await Configuration.initialize();
  } catch (error: unknown) {
    logger.error(`Failed to initialize configuration: ${error}`);
    throw error;
  }
};

/**
 * Get all configuration as a debug string
 */
export const getConfiguration = async (): Promise<string> => {
  const allConfig = Configuration.getAll();
  return JSON.stringify(allConfig, null, 2);
};

const configurationSchema = new mongoose.Schema<ConfigurationDocument, ConfigurationModel>(
  {
    description: {
      description: "Human-readable description of the configuration key",
      type: String,
    },
    key: {
      description: "Unique identifier for the configuration entry",
      index: true,
      required: true,
      type: String,
      unique: true,
    },
    type: {
      description: "Data type of the configuration value",
      enum: ["string", "number", "boolean"],
      required: true,
      type: String,
    },
    value: {
      description: "The configuration value",
      required: true,
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    strict: "throw",
    toJSON: {virtuals: true},
    toObject: {virtuals: true},
  }
);

addDefaultPlugins(configurationSchema);

// Define methods
configurationSchema.methods = {
  getValue(this: ConfigurationDocument): ConfigValueType {
    return this.value;
  },
};

export const ConfigurationDB = mongoose.model<ConfigurationDocument, ConfigurationModel>(
  "Configuration",
  configurationSchema
);

// Define custom statics after model creation
ConfigurationDB.getByKey = async function (key: string): Promise<ConfigurationDocument | null> {
  return this.findOneOrNone({key});
};

// biome-ignore lint/suspicious/noExplicitAny: Setting a static method on the model.
(ConfigurationDB as any).setValue = async function (
  key: string,
  value: ConfigValueType
): Promise<ConfigurationDocument> {
  const existing = await this.findOne({key});

  if (existing) {
    existing.value = value;
    return existing.save();
  }

  // Infer type from value
  let type: "string" | "number" | "boolean" = "string";
  if (typeof value === "number") {
    type = "number";
  } else if (typeof value === "boolean") {
    type = "boolean";
  }

  return this.create({
    key,
    type,
    value,
  });
};
