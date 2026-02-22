/**
 * OpenAPI Request Validator
 *
 * Provides runtime validation of incoming requests against OpenAPI schemas.
 * Uses AJV for JSON Schema validation with OpenAPI-compatible settings.
 *
 * Validation is always installed as middleware but only activates after
 * `configureOpenApiValidator()` is called. This makes it safe to include
 * in modelRouter by default.
 *
 * @module openApiValidator
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * // Enable validation globally at server startup
 * configureOpenApiValidator({
 *   removeAdditional: true,
 *   onAdditionalPropertiesRemoved: (props, req) => {
 *     logger.warn(`Stripped: ${props.join(", ")} on ${req.method} ${req.path}`);
 *   },
 * });
 *
 * // modelRouter automatically validates when configured
 * modelRouter(Todo, {
 *   permissions: {...},
 *   validation: {
 *     validateCreate: true,
 *     validateUpdate: true,
 *     validateQuery: true,
 *   },
 * });
 * ```
 */

import Ajv, {type ErrorObject, type ValidateFunction} from "ajv";
import addFormats from "ajv-formats";
import type {NextFunction, Request, Response} from "express";
import type {Model} from "mongoose";
import m2s from "mongoose-to-swagger";

import {APIError} from "./errors";
import {logger} from "./logger";
import type {OpenApiSchema, OpenApiSchemaProperty} from "./openApiBuilder";

/**
 * Global configuration for OpenAPI validation.
 * This can be set at server startup to control validation behavior.
 */
export interface OpenApiValidatorConfig {
  /**
   * Enable or disable request body validation.
   * Default: true (when configureOpenApiValidator is called)
   */
  validateRequests?: boolean;

  /**
   * Enable or disable response validation.
   * Default: false (response validation has performance overhead)
   */
  validateResponses?: boolean;

  /**
   * Whether to coerce types (e.g., string "123" to number 123).
   * Default: true
   */
  coerceTypes?: boolean;

  /**
   * Whether to remove additional properties not in the schema.
   * Default: true
   */
  removeAdditional?: boolean;

  /**
   * Custom error handler for validation failures.
   * If not provided, throws an APIError with status 400.
   */
  onValidationError?: (errors: ErrorObject[], req: Request) => void;

  /**
   * Log validation errors for debugging.
   * Default: true
   */
  logValidationErrors?: boolean;

  /**
   * Callback fired when additional properties are removed from a request body.
   * Only fires when `removeAdditional: true` and extra properties are present.
   * Receives the list of removed property names and the request.
   */
  onAdditionalPropertiesRemoved?: (removedProperties: string[], req: Request) => void;
}

// Whether configureOpenApiValidator() has been called
let isConfigured = false;

// Global validator configuration - can be modified at runtime
let globalConfig: OpenApiValidatorConfig = {
  coerceTypes: true,
  logValidationErrors: true,
  removeAdditional: true,
  validateRequests: true,
  validateResponses: false,
};

/**
 * Check whether `configureOpenApiValidator()` has been called.
 * Validation middleware is a no-op when this returns false.
 */
export function isOpenApiValidatorConfigured(): boolean {
  return isConfigured;
}

/**
 * Configure the global OpenAPI validator settings.
 * Calling this function activates validation — middleware that was previously
 * installed as a no-op will begin validating requests.
 *
 * @param config - Configuration options to merge with existing config
 *
 * @example
 * ```typescript
 * configureOpenApiValidator({
 *   removeAdditional: true,
 *   onAdditionalPropertiesRemoved: (props, req) => {
 *     Sentry.captureMessage(`Stripped: ${props.join(", ")} on ${req.method} ${req.path}`);
 *   },
 * });
 * ```
 */
export function configureOpenApiValidator(config: Partial<OpenApiValidatorConfig> = {}): void {
  isConfigured = true;
  globalConfig = {...globalConfig, ...config};
  // Clear cached AJV instances so new config takes effect
  ajvCache.clear();
  validatorCache.clear();
  logger.debug(`OpenAPI validator configured: ${JSON.stringify(globalConfig)}`);
}

/**
 * Get the current global validator configuration.
 */
export function getOpenApiValidatorConfig(): OpenApiValidatorConfig {
  return {...globalConfig};
}

/**
 * Reset the global validator configuration to defaults.
 * Also resets `isConfigured` to false.
 * Useful for testing.
 */
export function resetOpenApiValidatorConfig(): void {
  isConfigured = false;
  globalConfig = {
    coerceTypes: true,
    logValidationErrors: true,
    removeAdditional: true,
    validateRequests: true,
    validateResponses: false,
  };
  ajvCache.clear();
  validatorCache.clear();
}

// Lazy AJV instance cache keyed by coerceTypes + removeAdditional
const ajvCache = new Map<string, Ajv>();

/**
 * Get or create an AJV instance with the current config settings.
 */
function getAjvInstance(): Ajv {
  const key = `coerce:${globalConfig.coerceTypes ?? true},remove:${globalConfig.removeAdditional ?? true}`;
  let instance = ajvCache.get(key);

  if (!instance) {
    instance = new Ajv({
      allErrors: true,
      coerceTypes: globalConfig.coerceTypes ?? true,
      removeAdditional: globalConfig.removeAdditional ?? true,
      strict: false,
      useDefaults: true,
      validateSchema: false,
    });
    addFormats(instance);
    ajvCache.set(key, instance);
  }

  return instance;
}

// Cache compiled validators by schema hash + config key
const validatorCache = new Map<string, ValidateFunction>();

/**
 * Generate a simple hash for a schema to use as a cache key.
 */
function hashSchema(schema: OpenApiSchema): string {
  return JSON.stringify(schema);
}

const VALID_JSON_SCHEMA_TYPES = new Set([
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
  "null",
]);

// mongoose-to-swagger emits non-standard type strings for some Mongoose types
const MONGOOSE_TYPE_MAP: Record<string, {type: string; format?: string}> = {
  dateonly: {format: "date", type: "string"},
  schemaobjectid: {type: "string"},
};

/**
 * Recursively replace non-standard mongoose-to-swagger types with valid JSON Schema types
 * so AJV can compile the schema.
 */
function sanitizeSchemaForAjv(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const result = {...schema};

  if (typeof result.type === "string" && !VALID_JSON_SCHEMA_TYPES.has(result.type)) {
    const mapped = MONGOOSE_TYPE_MAP[result.type];
    if (mapped) {
      result.type = mapped.type;
      if (mapped.format && !result.format) {
        result.format = mapped.format;
      }
    } else {
      result.type = "string";
    }
  }

  if (result.items && typeof result.items === "object") {
    result.items = sanitizeSchemaForAjv(result.items as Record<string, unknown>);
  }

  if (result.properties && typeof result.properties === "object") {
    const sanitizedProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result.properties as Record<string, unknown>)) {
      sanitizedProps[key] =
        typeof value === "object" && value !== null
          ? sanitizeSchemaForAjv(value as Record<string, unknown>)
          : value;
    }
    result.properties = sanitizedProps;
  }

  if (result.additionalProperties && typeof result.additionalProperties === "object") {
    result.additionalProperties = sanitizeSchemaForAjv(
      result.additionalProperties as Record<string, unknown>
    );
  }

  return result;
}

/**
 * Get or create a compiled validator for a schema.
 * Uses the current config so changes take effect on next call.
 * Sanitizes non-standard mongoose-to-swagger types before compilation.
 * Returns null if the schema still cannot be compiled after sanitization.
 */
function getValidator(schema: OpenApiSchema): ValidateFunction | null {
  const ajv = getAjvInstance();
  const configKey = `coerce:${globalConfig.coerceTypes ?? true},remove:${globalConfig.removeAdditional ?? true}`;
  const hash = `${configKey}:${hashSchema(schema)}`;
  const cached = validatorCache.get(hash);

  if (cached !== undefined) {
    return cached;
  }

  const sanitized = sanitizeSchemaForAjv(schema);

  try {
    const validator = ajv.compile(sanitized);
    validatorCache.set(hash, validator);
    return validator;
  } catch (err) {
    logger.debug(
      `Could not compile validation schema after sanitization: ${(err as Error).message}`
    );
    validatorCache.set(hash, null as unknown as ValidateFunction);
    return null;
  }
}

/**
 * Format AJV errors into a human-readable string.
 */
function formatValidationErrors(errors: ErrorObject[]): string {
  return errors
    .map((err) => {
      const path = err.instancePath || "/";
      const message = err.message || "validation failed";
      return `${path}: ${message}`;
    })
    .join("; ");
}

/**
 * Convert OpenApiSchemaProperty to a full OpenApiSchema suitable for AJV.
 * Strips `required` from individual properties (OpenAPI-style) and moves it
 * to the schema-level `required` array (JSON Schema-style) for AJV compatibility.
 */
function propertiesToSchema(
  properties: Record<string, OpenApiSchemaProperty>,
  requiredFields?: string[]
): OpenApiSchema {
  // Extract required fields from properties that have required: true
  const autoRequired = Object.entries(properties)
    .filter(([_, prop]) => prop.required)
    .map(([key]) => key);

  const allRequired = [...new Set([...(requiredFields ?? []), ...autoRequired])];

  // Strip `required` from individual properties — AJV only accepts `required` at schema level
  const cleanedProperties: Record<string, OpenApiSchemaProperty> = {};
  for (const [key, prop] of Object.entries(properties)) {
    const {required: _, ...rest} = prop;
    cleanedProperties[key] = rest as OpenApiSchemaProperty;
  }

  const schema: OpenApiSchema = {
    properties: cleanedProperties,
    required: allRequired.length > 0 ? allRequired : undefined,
    type: "object",
  };

  // When removeAdditional is enabled, set additionalProperties: false
  // so AJV knows to strip unknown properties
  if (globalConfig.removeAdditional) {
    schema.additionalProperties = false;
  }

  return schema;
}

/**
 * Options for the request body validator middleware.
 */
export interface RequestBodyValidatorOptions {
  /**
   * Override the global validateRequests setting for this specific route.
   */
  enabled?: boolean;

  /**
   * List of required field names.
   */
  required?: string[];

  /**
   * Fields to exclude from validation (e.g. fields set by preCreate hooks).
   * Excluded fields are removed from both the schema properties and the required array.
   */
  excludeFields?: string[];

  /**
   * Custom error handler for this specific route.
   */
  onError?: (errors: ErrorObject[], req: Request) => void;

  /**
   * Callback fired when additional properties are removed.
   * Overrides the global onAdditionalPropertiesRemoved for this route.
   */
  onAdditionalPropertiesRemoved?: (removedProperties: string[], req: Request) => void;
}

/**
 * Creates middleware that validates the request body against an OpenAPI schema.
 *
 * The middleware checks `isConfigured` at request time — if `configureOpenApiValidator()`
 * has not been called, the middleware is a no-op.
 *
 * @param schema - The schema to validate against (same format as withRequestBody)
 * @param options - Optional configuration for this validator
 * @returns Express middleware function
 */
export function validateRequestBody(
  schema: Record<string, OpenApiSchemaProperty>,
  options?: RequestBodyValidatorOptions
): (req: Request, res: Response, next: NextFunction) => void {
  const fullSchema = propertiesToSchema(schema, options?.required);

  return (req: Request, _res: Response, next: NextFunction): void => {
    // No-op if not configured
    if (!isConfigured) {
      next();
      return;
    }

    // Check if validation is enabled (route override takes precedence)
    const isEnabled = options?.enabled ?? globalConfig.validateRequests;

    if (!isEnabled) {
      next();
      return;
    }

    // Capture keys before validation for removeAdditional detection
    const keysBefore = req.body && typeof req.body === "object" ? Object.keys(req.body) : [];

    // Get validator at request time so config changes take effect
    const validator = getValidator(fullSchema);

    // If schema couldn't be compiled (e.g., non-standard types), skip validation
    if (!validator) {
      next();
      return;
    }

    // Clone body if we might modify it (coercion or removeAdditional)
    const bodyToValidate: Record<string, unknown> = {...req.body};

    const valid = validator(bodyToValidate);

    if (!valid && validator.errors) {
      const errors = validator.errors;

      if (globalConfig.logValidationErrors) {
        logger.warn(
          `Request body validation failed for ${req.method} ${req.path}: ${formatValidationErrors(errors)}`
        );
      }

      // Use custom error handler if provided
      const errorHandler = options?.onError ?? globalConfig.onValidationError;
      if (errorHandler) {
        errorHandler(errors, req);
        next();
        return;
      }

      // Default: throw APIError
      throw new APIError({
        detail: formatValidationErrors(errors),
        disableExternalErrorTracking: true,
        meta: {
          validationErrors: JSON.stringify(
            errors.map((e) => ({
              message: e.message,
              params: e.params,
              path: e.instancePath,
            }))
          ),
        },
        source: {
          pointer: "/body",
        },
        status: 400,
        title: "Request validation failed",
      });
    }

    // Update req.body with coerced/stripped values
    if (valid) {
      // Detect removed properties (top-level only)
      if (globalConfig.removeAdditional) {
        const keysAfter = Object.keys(bodyToValidate);
        const removedProperties = keysBefore.filter((k) => !keysAfter.includes(k));

        if (removedProperties.length > 0) {
          const hook =
            options?.onAdditionalPropertiesRemoved ?? globalConfig.onAdditionalPropertiesRemoved;
          if (hook) {
            hook(removedProperties, req);
          }

          if (globalConfig.logValidationErrors) {
            logger.debug(
              `Stripped additional properties from ${req.method} ${req.path}: ${removedProperties.join(", ")}`
            );
          }
        }
      }

      req.body = bodyToValidate;
    }

    next();
  };
}

/**
 * Options for the query parameter validator middleware.
 */
export interface QueryValidatorOptions {
  /**
   * Override the global validateRequests setting for this specific route.
   */
  enabled?: boolean;

  /**
   * Custom error handler for this specific route.
   */
  onError?: (errors: ErrorObject[], req: Request) => void;
}

/**
 * Creates middleware that validates query parameters against an OpenAPI schema.
 *
 * @param schema - The schema to validate against
 * @param options - Optional configuration for this validator
 * @returns Express middleware function
 */
export function validateQueryParams(
  schema: Record<string, OpenApiSchemaProperty>,
  options?: QueryValidatorOptions
): (req: Request, res: Response, next: NextFunction) => void {
  const fullSchema = propertiesToSchema(schema);

  return (req: Request, _res: Response, next: NextFunction): void => {
    // No-op if not configured
    if (!isConfigured) {
      next();
      return;
    }

    const isEnabled = options?.enabled ?? globalConfig.validateRequests;

    if (!isEnabled) {
      next();
      return;
    }

    // Get validator at request time
    const validator = getValidator(fullSchema);

    // If schema couldn't be compiled, skip validation
    if (!validator) {
      next();
      return;
    }

    const queryToValidate = globalConfig.coerceTypes ? {...req.query} : req.query;
    const valid = validator(queryToValidate);

    if (!valid && validator.errors) {
      const errors = validator.errors;

      if (globalConfig.logValidationErrors) {
        logger.warn(
          `Query parameter validation failed for ${req.method} ${req.path}: ${formatValidationErrors(errors)}`
        );
      }

      const errorHandler = options?.onError ?? globalConfig.onValidationError;
      if (errorHandler) {
        errorHandler(errors, req);
        next();
        return;
      }

      throw new APIError({
        detail: formatValidationErrors(errors),
        disableExternalErrorTracking: true,
        meta: {
          validationErrors: JSON.stringify(
            errors.map((e) => ({
              message: e.message,
              params: e.params,
              path: e.instancePath,
            }))
          ),
        },
        source: {
          parameter: errors[0]?.instancePath?.replace("/", "") || "unknown",
        },
        status: 400,
        title: "Query parameter validation failed",
      });
    }

    if (globalConfig.coerceTypes && valid) {
      // Note: req.query is read-only in some Express versions,
      // so we may need to work around this
      Object.assign(req.query, queryToValidate);
    }

    next();
  };
}

/**
 * Options for creating a combined validation middleware.
 */
export interface CreateValidatorOptions {
  /**
   * Schema for request body validation.
   */
  body?: Record<string, OpenApiSchemaProperty>;

  /**
   * Schema for query parameter validation.
   */
  query?: Record<string, OpenApiSchemaProperty>;

  /**
   * Override the global validation enabled setting.
   */
  enabled?: boolean;
}

/**
 * Creates a combined validation middleware for both body and query parameters.
 *
 * @param options - Configuration for what to validate
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * router.post("/search", [
 *   openApiMiddleware,
 *   createValidator({
 *     body: {query: {type: "string", required: true}},
 *     query: {limit: {type: "number"}},
 *   }),
 * ], handler);
 * ```
 */
export function createValidator(
  options: CreateValidatorOptions
): (req: Request, res: Response, next: NextFunction) => void {
  const bodyValidator = options.body
    ? validateRequestBody(options.body, {enabled: options.enabled})
    : null;

  const queryValidator = options.query
    ? validateQueryParams(options.query, {enabled: options.enabled})
    : null;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Run body validation first
    if (bodyValidator) {
      bodyValidator(req, res, ((err?: any) => {
        if (err) {
          next(err);
          return;
        }

        // Then run query validation
        if (queryValidator) {
          queryValidator(req, res, next);
        } else {
          next();
        }
      }) as NextFunction);
    } else if (queryValidator) {
      queryValidator(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * Validates response data against a schema.
 * This is primarily for development/testing to ensure responses match documentation.
 *
 * @param data - The response data to validate
 * @param schema - The expected schema
 * @returns Object with valid flag and any errors
 */
export function validateResponseData(
  data: unknown,
  schema: Record<string, OpenApiSchemaProperty>
): {valid: boolean; errors?: ErrorObject[]} {
  if (!globalConfig.validateResponses) {
    return {valid: true};
  }

  const fullSchema = propertiesToSchema(schema);
  const validator = getValidator(fullSchema);

  if (!validator) {
    return {valid: true};
  }

  const valid = validator(data);

  if (!valid && validator.errors) {
    if (globalConfig.logValidationErrors) {
      logger.warn(`Response validation failed: ${formatValidationErrors(validator.errors)}`);
    }
    return {errors: validator.errors, valid: false};
  }

  return {valid: true};
}

const m2sOptions = {
  props: ["readOnly", "required", "enum", "default"],
};

/**
 * Extract an OpenAPI-compatible schema from a Mongoose model.
 * This allows you to use the same schema definitions for both documentation
 * and runtime validation.
 *
 * @param model - A Mongoose model
 * @returns Schema properties suitable for validation
 */
export function getSchemaFromModel<T>(model: Model<T>): Record<string, OpenApiSchemaProperty> {
  const modelSwagger = m2s(model, m2sOptions);
  return modelSwagger.properties as Record<string, OpenApiSchemaProperty>;
}

/**
 * Extract required field names from a Mongoose model's swagger schema.
 */
function getRequiredFieldsFromModel<T>(model: Model<T>): string[] {
  const modelSwagger = m2s(model, m2sOptions);
  return (modelSwagger.required as string[]) ?? [];
}

/**
 * Creates a request body validator middleware from a Mongoose model.
 * This is a convenience function that combines getSchemaFromModel and validateRequestBody.
 *
 * @param model - A Mongoose model to derive the schema from
 * @param options - Optional configuration for the validator
 * @returns Express middleware function
 */
export function validateModelRequestBody<T>(
  model: Model<T>,
  options?: RequestBodyValidatorOptions
): (req: Request, res: Response, next: NextFunction) => void {
  let schema = getSchemaFromModel(model);
  let requiredFields = getRequiredFieldsFromModel(model);

  if (options?.excludeFields?.length) {
    const excluded = new Set(options.excludeFields);
    schema = Object.fromEntries(Object.entries(schema).filter(([key]) => !excluded.has(key)));
    requiredFields = requiredFields.filter((f) => !excluded.has(f));
  }

  return validateRequestBody(schema, {
    ...options,
    required: [...(options?.required ?? []), ...requiredFields],
  });
}

/**
 * Options for creating validation middleware for a modelRouter.
 */
export interface ModelRouterValidationOptions {
  /**
   * Enable validation for create (POST) requests.
   * Default: true (when validation is globally enabled)
   */
  validateCreate?: boolean;

  /**
   * Enable validation for update (PATCH) requests.
   * Default: true (when validation is globally enabled)
   */
  validateUpdate?: boolean;

  /**
   * Enable validation for query (GET list) requests.
   * Default: true (when validation is globally enabled)
   */
  validateQuery?: boolean;

  /**
   * Fields to exclude from create validation (e.g. fields injected by preCreate).
   */
  excludeFromCreate?: string[];

  /**
   * Fields to exclude from update validation (e.g. fields injected by preUpdate).
   */
  excludeFromUpdate?: string[];

  /**
   * Custom error handler for validation failures.
   */
  onError?: (errors: ErrorObject[], req: Request) => void;

  /**
   * Callback fired when additional properties are removed from a request body.
   * Overrides the global onAdditionalPropertiesRemoved for this router.
   */
  onAdditionalPropertiesRemoved?: (removedProperties: string[], req: Request) => void;
}

/**
 * Creates validation middleware for use with modelRouter.
 * Returns an object with middleware for each operation type.
 *
 * @param model - The Mongoose model
 * @param options - Configuration options
 * @returns Object with create and update validation middleware
 */
export function createModelValidators<T>(
  model: Model<T>,
  options?: ModelRouterValidationOptions
): {
  create: (req: Request, res: Response, next: NextFunction) => void;
  update: (req: Request, res: Response, next: NextFunction) => void;
} {
  const schema = getSchemaFromModel(model);

  return {
    create: validateRequestBody(schema, {
      enabled: options?.validateCreate,
      onAdditionalPropertiesRemoved: options?.onAdditionalPropertiesRemoved,
      onError: options?.onError,
    }),
    update: validateRequestBody(schema, {
      enabled: options?.validateUpdate,
      onAdditionalPropertiesRemoved: options?.onAdditionalPropertiesRemoved,
      onError: options?.onError,
    }),
  };
}

/**
 * Build a query parameter schema from a model's Mongoose schema and queryFields array.
 * Always includes pagination parameters (limit, page, sort).
 *
 * @param model - A Mongoose model
 * @param queryFields - Array of field names allowed for querying
 * @returns Schema properties suitable for query validation
 */
export function buildQuerySchemaFromFields<T>(
  model: Model<T>,
  queryFields: string[] = []
): Record<string, OpenApiSchemaProperty> {
  const modelSchema = getSchemaFromModel(model);
  const querySchema: Record<string, OpenApiSchemaProperty> = {
    limit: {type: "number"},
    page: {type: "number"},
    sort: {type: "string"},
  };

  for (const field of queryFields) {
    const modelField = modelSchema[field];
    if (modelField) {
      // Use the model's type info, but mark as not required for queries
      querySchema[field] = {...modelField, required: false};
    } else {
      // Field not in model schema — allow as string
      querySchema[field] = {type: "string"};
    }
  }

  return querySchema;
}
