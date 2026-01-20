import {existsSync, readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getDocsRoot = (): string => {
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

const loadMarkdown = (filename: string): string => {
  const filePath = join(getDocsRoot(), "resources", filename);
  return readFileSync(filePath, "utf-8");
};

interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  content: string;
}

export const resources: Resource[] = [
  {
    content: loadMarkdown("overview.md"),
    description: "Overview of the Terreno monorepo and its packages",
    mimeType: "text/markdown",
    name: "Terreno Overview",
    uri: "terreno://docs/overview",
  },
  {
    content: loadMarkdown("api.md"),
    description: "Complete documentation for the @terreno/api package",
    mimeType: "text/markdown",
    name: "@terreno/api Documentation",
    uri: "terreno://docs/api",
  },
  {
    content: loadMarkdown("ui.md"),
    description: "Complete documentation for the @terreno/ui package",
    mimeType: "text/markdown",
    name: "@terreno/ui Documentation",
    uri: "terreno://docs/ui",
  },
  {
    content: loadMarkdown("rtk.md"),
    description: "Complete documentation for the @terreno/rtk package",
    mimeType: "text/markdown",
    name: "@terreno/rtk Documentation",
    uri: "terreno://docs/rtk",
  },
  {
    content: loadMarkdown("patterns.md"),
    description: "Common patterns and best practices for Terreno development",
    mimeType: "text/markdown",
    name: "Terreno Patterns & Best Practices",
    uri: "terreno://docs/patterns",
  },
];
