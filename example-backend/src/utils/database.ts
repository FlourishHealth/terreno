import {logger} from "@terreno/api";
import mongoose from "mongoose";
import {initConfiguration} from "../models/configuration";

export const resolveMongoDbName = (mongoDbName?: string): string | undefined => {
  const trimmed = mongoDbName?.trim();
  return trimmed || undefined;
};

export const connectToMongoDB = async (): Promise<void> => {
  // Check if already connected
  if (mongoose.connection.readyState === 1) {
    logger.info("Already connected to MongoDB");
    return;
  }

  const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/terreno-example";
  const mongoDbName = resolveMongoDbName(process.env.MONGO_DB_NAME);

  try {
    await mongoose.connect(mongoURI, mongoDbName ? {dbName: mongoDbName} : undefined);
    logger.info(`Connected to MongoDB database ${mongoose.connection.name}`);

    // Initialize configuration system after MongoDB connection
    try {
      await initConfiguration();
      logger.info("Configuration system initialized");
    } catch (error: unknown) {
      logger.error(`Failed to initialize configuration: ${error}`);
      // Continue without configuration system - fall back to env vars
    }
  } catch (error: unknown) {
    logger.error(`MongoDB connection error: ${error}`);
    throw error;
  }

  mongoose.connection.on("error", (error: unknown) => {
    logger.error(`MongoDB connection error: ${error}`);
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });
};
