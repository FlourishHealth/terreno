import flatten from "lodash/flatten";
import merge from "lodash/merge";
import type {Model} from "mongoose";
import m2s from "mongoose-to-swagger";

import type {modelRouterOptions} from "./api";
import {logger} from "./logger";
import {getOpenApiSpecForModel} from "./populate";

const noop = (_a, _b, next) => next();

const m2sOptions = {
  props: ["readOnly", "required", "enum", "default"],
};

export const apiErrorContent = {
  "application/json": {
    schema: {$ref: "#/components/schemas/APIError"},
  },
};

// Default error responses
export const defaultOpenApiErrorResponses = {
  400: {
    content: apiErrorContent,
    description: "Bad request",
  },
  401: {
    description: "The user must be authenticated",
  },
  403: {
    content: apiErrorContent,
    description: "The user is not allowed to perform this action on this document",
  },
  404: {
    content: apiErrorContent,
    description: "Document not found",
  },
  405: {
    content: apiErrorContent,
    description: "The user is not allowed to perform this action on any document",
  },
};

// We repeat this constantly, so we make it a component so we only have to define it once.
function createAPIErrorComponent(openApi: any) {
  // Create a schema component called APIError
  openApi?.component("schemas", "APIError", {
    properties: {
      code: {
        description: "An application-specific error code, expressed as a string value.",
        type: "string",
      },
      detail: {
        description:
          "A human-readable explanation specific to this occurrence of the problem. Like title, this field’s value can be localized.",
        type: "string",
      },
      id: {
        description: "A unique identifier for this particular occurrence of the problem.",
        type: "string",
      },
      links: {
        properties: {
          about: {
            description:
              "A link that leads to further details about this particular occurrence of the problem. When derefenced, this URI SHOULD return a human-readable description of the error.",
            type: "string",
          },
          type: {
            description:
              "A link that identifies the type of error that this particular error is an instance of. This URI SHOULD be dereferencable to a human-readable explanation of the general error.",
            type: "string",
          },
        },
        type: "object",
      },
      meta: {
        description: "A meta object containing non-standard meta-information about the error.",
        type: "object",
      },
      source: {
        properties: {
          header: {
            description:
              "A string indicating the name of a single request header which caused the error.",
            type: "string",
          },
          parameter: {
            description: "A string indicating which URI query parameter caused the error.",
            type: "string",
          },
          pointer: {
            description:
              'A JSON Pointer [RFC6901] to the associated entity in the request document [e.g. "/data" for a primary data object, or "/data/attributes/title" for a specific attribute].',
            type: "string",
          },
        },
        type: "object",
      },
      status: {
        description:
          "The HTTP status code applicable to this problem, expressed as a string value.",
        type: "number",
      },
      title: {
        description: "The error message",
        type: "string",
      },
    },
    type: "object",
  });
}

export function getOpenApiMiddleware<T>(model: Model<T>, options: Partial<modelRouterOptions<T>>) {
  createAPIErrorComponent(options.openApi);
  if (!options.openApi?.path) {
    // Just log this once rather than for each middleware.
    logger.debug("No options.openApi provided, skipping *OpenApiMiddleware");
    return noop;
  }

  if (options.permissions?.read?.length === 0) {
    return noop;
  }

  const {properties, required} = getOpenApiSpecForModel(model, {
    extraModelProperties: options.openApiExtraModelProperties,
    populatePaths: options.populatePaths,
  });

  return options.openApi.path(
    merge(
      {
        responses: {
          200: {
            content: {
              "application/json": {
                schema: {
                  properties,
                  required: [...required, "_id", "created", "updated"],
                  type: "object",
                },
              },
            },
            description: "Successful read",
          },
          ...defaultOpenApiErrorResponses,
        },
        tags: [model.collection.collectionName],
      },
      options.openApiOverwrite?.get ?? {}
    )
  );
}

export function listOpenApiMiddleware<T>(model: Model<T>, options: Partial<modelRouterOptions<T>>) {
  if (!options.openApi?.path) {
    return noop;
  }

  if (options.permissions?.list?.length === 0) {
    return noop;
  }

  const modelSwagger = m2s(model, m2sOptions);

  // TODO: handle permissions

  // Convert modelRouter queryFields into OpenAPI parameters
  const defaultQueryParams = [
    {
      in: "query",
      name: "_id",
      schema: {
        properties: {
          $in: {
            items: {
              type: "string",
            },
            type: "array",
          },
        },
        type: "object",
      },
    },
  ];
  const modelQueryParams = flatten(
    options.queryFields
      // Remove _id from queryFields, we handle that above.
      ?.filter((field) => field !== "_id")
      .map((field) => {
        const params: {name: string; in: "query"; schema: any}[] = [];

        // Check for datetime/number to support gt/gte/lt/lte
        if (
          modelSwagger.properties[field]?.type === "number" ||
          modelSwagger.properties[field]?.format === "date-time"
        ) {
          params.push({
            in: "query",
            name: field,
            schema: {
              oneOf: [
                modelSwagger.properties[field],
                {
                  properties: {
                    $gt: modelSwagger.properties[field],
                    $gte: modelSwagger.properties[field],
                    $lt: modelSwagger.properties[field],
                    $lte: modelSwagger.properties[field],
                  },
                  type: "object",
                },
              ],
            },
          });
        } else {
          params.push({
            in: "query",
            name: field,
            schema: {
              oneOf: [
                modelSwagger.properties[field],
                {
                  properties: {
                    $in: {
                      items: {
                        type: modelSwagger.properties[field]?.type,
                      },
                      type: "array",
                    },
                  },
                  type: "object",
                },
              ],
            },
          });
        }

        return params;
      })
  );

  const {properties, required} = getOpenApiSpecForModel(model, {
    extraModelProperties: options.openApiExtraModelProperties,
    populatePaths: options.populatePaths,
  });
  return options.openApi.path(
    merge(
      {
        parameters: [
          ...defaultQueryParams,
          ...(modelQueryParams ?? []),
          // pagination
          {
            in: "query",
            name: "page",
            schema: {
              type: "number",
            },
          },
          {
            in: "query",
            name: "sort",
            schema: {
              type: "string",
            },
          },
          {
            in: "query",
            name: "limit",
            schema: {
              type: "number",
            },
          },
        ],
        responses: {
          200: {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    data: {
                      items: {
                        properties,
                        required: [...required, "_id", "created", "updated"],
                        type: "object",
                      },
                      type: "array",
                    },
                    limit: {
                      type: "number",
                    },
                    more: {
                      type: "boolean",
                    },
                    page: {
                      type: "number",
                    },
                    total: {
                      type: "number",
                    },
                  },
                  type: "object",
                },
              },
            },
            description: "Successful list",
          },
          ...defaultOpenApiErrorResponses,
        },
        tags: [model.collection.collectionName],
      },
      options.openApiOverwrite?.list ?? {}
    )
  );
}

export function createOpenApiMiddleware<T>(
  model: Model<T>,
  options: Partial<modelRouterOptions<T>>
) {
  if (!options.openApi?.path) {
    return noop;
  }

  if (options.permissions?.create?.length === 0) {
    return noop;
  }

  const {properties, required} = getOpenApiSpecForModel(model, {
    extraModelProperties: options.openApiExtraModelProperties,
    populatePaths: options.populatePaths,
  });
  return options.openApi.path(
    merge(
      {
        requestBody: {
          content: {
            "application/json": {
              schema: {
                properties,
                type: "object",
              },
            },
          },
          required: true,
        },
        responses: {
          201: {
            content: {
              "application/json": {
                schema: {
                  properties,
                  required: [...required, "_id", "created", "updated"],
                  type: "object",
                },
              },
            },
            description: "Successful create",
          },
          ...defaultOpenApiErrorResponses,
        },
        tags: [model.collection.collectionName],
      },
      options.openApiOverwrite?.create ?? {}
    )
  );
}

export function patchOpenApiMiddleware<T>(
  model: Model<T>,
  options: Partial<modelRouterOptions<T>>
) {
  if (!options.openApi?.path) {
    return noop;
  }

  if (options.permissions?.update?.length === 0) {
    return noop;
  }

  const {properties, required} = getOpenApiSpecForModel(model, {
    extraModelProperties: options.openApiExtraModelProperties,
    populatePaths: options.populatePaths,
  });
  return options.openApi.path(
    merge(
      {
        requestBody: {
          content: {
            "application/json": {
              schema: {
                properties,
                type: "object",
              },
            },
          },
          required: true,
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: {
                  properties,
                  required: [...required, "_id", "created", "updated"],
                  type: "object",
                },
              },
            },
            description: "Successful update",
          },
          ...defaultOpenApiErrorResponses,
        },
        tags: [model.collection.collectionName],
      },
      options.openApiOverwrite?.update ?? {}
    )
  );
}

export function deleteOpenApiMiddleware<T>(
  model: Model<T>,
  options: Partial<modelRouterOptions<T>>
) {
  if (!options.openApi?.path) {
    return noop;
  }

  if (options.permissions?.delete?.length === 0) {
    return noop;
  }

  return options.openApi.path(
    merge(
      {
        responses: {
          204: {
            description: "Successful delete",
          },
          ...defaultOpenApiErrorResponses,
        },
        tags: [model.collection.collectionName],
      },
      options.openApiOverwrite?.delete ?? {}
    )
  );
}

// This is a generic OpenAPI wrapper for a read that returns any object described by `properties`.
// Useful for endpoints that don't directly map to a model.
export function readOpenApiMiddleware<T>(
  options: Partial<modelRouterOptions<T>>,
  properties: any,
  required: string[],
  queryParameters: any
): any {
  if (!options.openApi?.path) {
    // Just log this once rather than for each middleware.
    logger.debug("No options.openApi provided, skipping *OpenApiMiddleware");
    return noop;
  }

  if (options.permissions?.read?.length === 0) {
    return noop;
  }

  return options.openApi.path(
    merge(
      {
        parameters: queryParameters,
        responses: {
          200: {
            content: {
              "application/json": {
                schema: {
                  properties,
                  required,
                  type: "object",
                },
              },
            },
            description: "Successful read",
          },
          ...defaultOpenApiErrorResponses,
        },
        tags: [],
      },
      options.openApiOverwrite?.get ?? {}
    )
  );
}
