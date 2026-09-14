import {readFile} from "node:fs/promises";

import type {OpenApiDocument} from "./types";

export const loadSpec = async (schema: string): Promise<OpenApiDocument> => {
  if (!schema) {
    throw new Error("Missing --schema (OpenAPI URL or JSON file path)");
  }
  if (/^https?:\/\//.test(schema)) {
    const response = await fetch(schema);
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI spec from ${schema}: ${response.status}`);
    }
    return (await response.json()) as OpenApiDocument;
  }
  const raw = await readFile(schema, "utf8");
  return JSON.parse(raw) as OpenApiDocument;
};
