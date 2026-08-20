import {spawn} from "node:child_process";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

const runBiomeFormat = async (filePath: string): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("bunx", ["biome", "check", "--write", filePath], {
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`biome format exited with code ${code ?? "unknown"}`));
    });
  });
};

export const formatOutput = async ({
  content,
  noFormat,
}: {
  content: string;
  noFormat: boolean;
}): Promise<string> => {
  if (noFormat) {
    return content;
  }

  const dir = await mkdtemp(join(tmpdir(), "syncdb-codegen-"));
  const filePath = join(dir, "syncDbSdk.ts");
  try {
    await writeFile(filePath, content, "utf8");
    await runBiomeFormat(filePath);
    const formatted = await Bun.file(filePath).text();
    return formatted;
  } catch {
    return content;
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
};
