import {existsSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Root directory for bundled markdown and ui-types-documentation.json.
 * Honours TERRENO_MCP_DOCS_DIR for tests and custom deployments.
 */
export const getDocsRoot = (): string => {
  if (process.env.TERRENO_MCP_DOCS_DIR) {
    return process.env.TERRENO_MCP_DOCS_DIR;
  }

  const bundledDocsRoot = join(__dirname, "docs");
  if (existsSync(bundledDocsRoot)) {
    return bundledDocsRoot;
  }

  if (process.execPath) {
    const execDocsRoot = join(dirname(process.execPath), "docs");
    if (existsSync(execDocsRoot)) {
      return execDocsRoot;
    }
  }

  return join(__dirname, "docs");
};
