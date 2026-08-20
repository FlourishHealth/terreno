import type {FriendlyHookNames} from "./types";

export const toPascalCase = (value: string): string =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

export const deriveFriendlyHookNames = (
  entitySchemaName: string,
  collection: string
): FriendlyHookNames => {
  const pluralName = toPascalCase(collection);
  return {
    create: `useCreate${entitySchemaName}`,
    delete: `useDelete${entitySchemaName}`,
    list: `use${pluralName}`,
    read: `use${entitySchemaName}`,
    update: `useUpdate${entitySchemaName}`,
  };
};
