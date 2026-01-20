/**
 * OpenAPI Request Validator
 *
 * Provides runtime validation of incoming requests against OpenAPI schemas.
 * Uses AJV for JSON Schema validation with OpenAPI-compatible settings.
 *
 * This module provides a configurable, opt-in validation layer that can be
 * easily enabled in development/staging and disabled in production for
 * performance if needed.
 *
 * @module openApiValidator
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * // Enable validation globally at server startup
 * configureOpenApiValidator({
 *   validateRequests: process.env.NODE_ENV !== "production",
 * });
 *
 * // Use with OpenApiMiddlewareBuilder
 * createOpenApiBuilder(options)
 *   .withRequestBody<{name: string}>({name: {type: "string", required: true}})
 *   .withValidation() // Enables validation for this route
 *   .build();
 *
 * // Or use standalone middleware
 * router.post("/users", [
 *   openApiMiddleware,
 *   validateRequestBody({name: {type: "string", required: true}}),
 * ], handler);
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
   * Default: false (opt-in for safety)
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
   * Default: false
   */
  removeAdditional?: boolean;

  /**
   * Custom error handler for validation failures.
   * If not provided, throws an APIError with status 400.
   */
  onValidationError?: (errors: ErrorObject[], req: Request) => void;

  /**
   * Log validation errors for debugging.
   * Default: true in development, false in production
   */
  logValidationErrors?: boolean;
}

// Global validator configuration - can be modified at runtime
let globalConfig: OpenApiValidatorConfig = {
  coerceTypes: true,
  logValidationErrors: process.env.NODE_ENV !== "production",
  removeAdditional: false,
  validateRequests: false,
  validateResponses: false,
};

/**
 * Configure the global OpenAPI validator settings.
 *
 * @param config - Configuration options to merge with existing config
 *
 * @example
 * ```typescript
 * // Enable validation in development
 * configureOpenApiValidator({
 *   validateRequests: process.env.NODE_ENV !== "production",
 *   logValidationErrors: true,
 * });
 * ```
 */
export function configureOpenApiValidator(config: Partial<OpenApiValidatorConfig>): void {
  globalConfig = {...globalConfig, ...config};
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
 * Useful for testing.
 */
export function resetOpenApiValidatorConfig(): void {
  globalConfig = {
    coerceTypes: true,
    logValidationErrors: process.env.NODE_ENV !== "production",
    removeAdditional: false,
    validateRequests: false,
    validateResponses: false,
  };
}

// Create a shared AJV instance with OpenAPI-compatible settings
const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  removeAdditional: false,
  strict: false,
  useDefaults: true,
});
addFormats(ajv);

// Cache compiled validators by schema hash
const validatorCache = new Map<string, ValidateFunction>();

/**
 * Generate a simple hash for a schema to use as a cache key.
 */
function hashSchema(schema: OpenApiSchema): string {
  return JSON.stringify(schema);
}

/**
 * Get or create a compiled validator for a schema.
 */
function getValidator(schema: OpenApiSchema): ValidateFunction {
  const hash = hashSchema(schema);
  let validator = validatorCache.get(hash);

  if (!validator) {
    validator = ajv.compile(schema);
    validatorCache.set(hash, validator);
  }

  return validator;
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

  return {
    properties,
    required: allRequired.length > 0 ? allRequired : undefined,
    type: "object",
  };
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
   * Custom error handler for this specific route.
   */
  onError?: (errors: ErrorObject[], req: Request) => void;
}

/**
 * Creates middleware that validates the request body against an OpenAPI schema.
 *
 * This middleware is designed to be used after the OpenAPI documentation middleware
 * but before the route handler.
 *
 * @param schema - The schema to validate against (same format as withRequestBody)
 * @param options - Optional configuration for this validator
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * router.post("/users", [
 *   createOpenApiBuilder(options)
 *     .withRequestBody<{name: string}>({name: {type: "string", required: true}})
 *     .build(),
 *   validateRequestBody({name: {type: "string", required: true}}),
 * ], asyncHandler(async (req, res) => {
 *   // req.body is guaranteed to match the schema
 * }));
 * ```
 */
export function validateRequestBody(
  schema: Record<string, OpenApiSchemaProperty>,
  options?: RequestBodyValidatorOptions
): (req: Request, res: Response, next: NextFunction) => void {
  const fullSchema = propertiesToSchema(schema, options?.required);
  const validator = getValidator(fullSchema);

  return (req: Request, _res: Response, next: NextFunction): void => {
    // Check if validation is enabled (route override takes precedence)
    const isEnabled = options?.enabled ?? globalConfig.validateRequests;

    if (!isEnabled) {
      next();
      return;
    }

    // Clone body if we might modify it (coercion)
    const bodyToValidate = globalConfig.coerceTypes ? {...req.body} : req.body;

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

    // If coercion is enabled, update req.body with coerced values
    if (globalConfig.coerceTypes && valid) {
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
  const validator = getValidator(fullSchema);

  return (req: Request, _res: Response, next: NextFunction): void => {
    const isEnabled = options?.enabled ?? globalConfig.validateRequests;

    if (!isEnabled) {
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
 *
 * @example
 * ```typescript
 * const userSchema = getSchemaFromModel(User);
 * const validateUser = validateRequestBody(userSchema);
 * ```
 */
export function getSchemaFromModel<T>(model: Model<T>): Record<string, OpenApiSchemaProperty> {
  const modelSwagger = m2s(model, m2sOptions);
  return modelSwagger.properties as Record<string, OpenApiSchemaProperty>;
}

/**
 * Creates a request body validator middleware from a Mongoose model.
 * This is a convenience function that combines getSchemaFromModel and validateRequestBody.
 *
 * @param model - A Mongoose model to derive the schema from
 * @param options - Optional configuration for the validator
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * router.post("/users", [
 *   createOpenApiMiddleware(User, options),
 *   validateModelRequestBody(User),
 * ], asyncHandler(async (req, res) => {
 *   // req.body is validated against the User model schema
 * }));
 * ```
 */
export function validateModelRequestBody<T>(
  model: Model<T>,
  options?: RequestBodyValidatorOptions
): (req: Request, res: Response, next: NextFunction) => void {
  const schema = getSchemaFromModel(model);
  return validateRequestBody(schema, options);
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
   * Custom error handler for validation failures.
   */
  onError?: (errors: ErrorObject[], req: Request) => void;
}

/**
 * Creates validation middleware for use with modelRouter.
 * Returns an object with middleware for each operation type.
 *
 * @param model - The Mongoose model
 * @param options - Configuration options
 * @returns Object with create and update validation middleware
 *
 * @example
 * ```typescript
 * const validators = createModelValidators(User, {validateCreate: true});
 *
 * // Use in custom endpoints within modelRouter
 * router.post("/custom", [
 *   validators.create,
 * ], handler);
 * ```
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
      onError: options?.onError,
    }),
    update: validateRequestBody(schema, {
      enabled: options?.validateUpdate,
      onError: options?.onError,
    }),
  };
}
