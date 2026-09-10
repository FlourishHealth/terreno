export const TERRENO_MCP_WRITE_SCAFFOLD_ENV = "TERRENO_MCP_WRITE_SCAFFOLD";

export const disableScaffoldWrites = (): void => {
  delete process.env[TERRENO_MCP_WRITE_SCAFFOLD_ENV];
};

export const enableScaffoldWrites = (): void => {
  process.env[TERRENO_MCP_WRITE_SCAFFOLD_ENV] = "1";
};

export const isScaffoldWriteEnabled = (): boolean => {
  return process.env[TERRENO_MCP_WRITE_SCAFFOLD_ENV] === "1";
};
