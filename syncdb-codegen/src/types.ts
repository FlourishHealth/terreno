export interface OpenApiSchema {
  $ref?: string;
  type?: string;
  format?: string;
  enum?: string[];
  items?: OpenApiSchema;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  oneOf?: OpenApiSchema[];
  additionalProperties?: boolean | OpenApiSchema;
  description?: string;
}

export interface OpenApiOperation {
  get?: OpenApiPathOperation;
  post?: OpenApiPathOperation;
  patch?: OpenApiPathOperation;
  delete?: OpenApiPathOperation;
}

export interface OpenApiPathOperation {
  "x-terreno-sync"?: {
    collection: string;
    scope: string;
  };
  requestBody?: {
    content?: {
      "application/json"?: {
        schema?: OpenApiSchema;
      };
    };
  };
  responses?: Record<
    string,
    {
      content?: {
        "application/json"?: {
          schema?: OpenApiSchema;
        };
      };
    }
  >;
}

export interface OpenApiDocument {
  openapi: string;
  paths: Record<string, OpenApiOperation>;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
  };
}

export interface CodegenConfigFile {
  overrides?: Record<
    string,
    {
      retries?: boolean | number;
    }
  >;
  exportName?: string;
  sdkImportPath?: string;
}

export interface DiscoveredCollection {
  collection: string;
  scope: string;
  listPath: string;
  entitySchemaName: string;
  createSchemaName?: string;
  updateSchemaName?: string;
  retries?: boolean | number;
}

export interface FriendlyHookNames {
  list: string;
  read: string;
  create: string;
  update: string;
  delete: string;
}
