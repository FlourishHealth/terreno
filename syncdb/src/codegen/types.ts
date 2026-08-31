export interface TerrenoSyncExtension {
  collection: string;
  scope: string;
}

export interface OpenApiSchema {
  type?: string;
  format?: string;
  enum?: Array<string | number | boolean>;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  $ref?: string;
  additionalProperties?: boolean | OpenApiSchema;
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  description?: string;
}

export interface OpenApiOperation {
  "x-terreno-sync"?: TerrenoSyncExtension;
  requestBody?: {
    content?: Record<string, {schema?: OpenApiSchema}>;
  };
  responses?: Record<
    string,
    {
      content?: Record<string, {schema?: OpenApiSchema}>;
    }
  >;
}

export interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  patch?: OpenApiOperation;
  put?: OpenApiOperation;
  delete?: OpenApiOperation;
}

export interface OpenApiDocument {
  paths?: Record<string, OpenApiPathItem>;
  components?: {schemas?: Record<string, OpenApiSchema>};
}

export interface DiscoveredCollection {
  collection: string;
  entityName: string;
  entitySchema: OpenApiSchema;
  createName: string;
  createSchema: OpenApiSchema;
  updateName: string;
  updateSchema: OpenApiSchema;
  retries?: boolean | number;
}

export interface CodegenConfigFile {
  overrides?: Record<string, {retries?: boolean | number}>;
  exportName?: string;
  sdkImportPath?: string;
}

export interface GenerateArgs {
  schema: string;
  out: string;
  collections?: string[];
  config?: CodegenConfigFile;
  format: boolean;
}
