import {readFile} from "node:fs/promises";

import type {OpenApiDocument} from "./types";

export const loadSpec = async (schemaSource: string): Promise<OpenApiDocument> => {
  if (!schemaSource) {
    throw new Error("Schema source is required");
  }

  if (schemaSource.startsWith("http://") || schemaSource.startsWith("https://")) {
    const response = await fetch(schemaSource);
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI spec (${response.status}): ${schemaSource}`);
    }
    return (await response.json()) as OpenApiDocument;
  }

  const raw = await readFile(schemaSource, "utf8");
  return JSON.parse(raw) as OpenApiDocument;
};
