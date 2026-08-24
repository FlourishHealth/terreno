import {readFileSync} from "node:fs";
import {join} from "node:path";

import {listModelExcerptFiles, resolveModelDirs, withMongooseDb} from "../mongoEnv.js";

interface DatabaseSchemaArgs {
  collectionFilter?: string;
  summary?: boolean;
}

const parseModelFiles = (modelsDir: string): string[] => {
  const names = listModelExcerptFiles(modelsDir);
  const summaries: string[] = [];
  for (const name of names) {
    const content = readFileSync(join(modelsDir, name), "utf-8");
    const lines = content.split("\n").slice(0, 80);
    summaries.push(`### ${name}\n\`\`\`typescript\n${lines.join("\n")}\n\`\`\``);
  }
  return summaries;
};

export const databaseSchema = async (args: DatabaseSchemaArgs): Promise<string> => {
  return withMongooseDb(async (db) => {
    const filter = args.collectionFilter?.toLowerCase().trim();
    const names = (await db.listCollections().toArray())
      .map((c) => c.name)
      .filter((n) => !filter || n.toLowerCase().includes(filter));

    const lines: string[] = ["# Database schema", ""];
    const modelDirs = resolveModelDirs();
    lines.push(
      "## Declared models (static scan of `backend/src/models` and `example-backend/src/models`)"
    );
    lines.push("");
    const modelBlocks = modelDirs.flatMap((dir) => parseModelFiles(dir));
    if (modelBlocks.length === 0) {
      lines.push("_(No model files found.)_");
    } else if (args.summary) {
      lines.push(
        `Found ${modelBlocks.length} model file(s). Re-run with \`summary: false\` for excerpts.`
      );
    } else {
      lines.push(...modelBlocks);
    }
    lines.push("");
    lines.push("## Live MongoDB");
    lines.push("");

    for (const name of names.sort()) {
      const coll = db.collection(name);
      const indexes = await coll.indexes();
      let count = 0;
      try {
        count = await coll.estimatedDocumentCount();
      } catch {
        count = -1;
      }
      lines.push(`### ${name}`);
      lines.push(`- **estimatedCount**: ${count}`);
      lines.push(`- **indexes**: \`${JSON.stringify(indexes)}\``);
      lines.push("");
    }

    return lines.join("\n");
  });
};
