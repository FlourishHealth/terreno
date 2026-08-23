import {mkdir, writeFile} from "node:fs/promises";
import {dirname} from "node:path";

import type {CliIo} from "../io";
import {printJson} from "../io";

export const maybeWrite = async (
  io: CliIo,
  content: string,
  outPath: string | undefined,
  json: boolean,
  extra?: Record<string, unknown>
): Promise<number> => {
  if (outPath) {
    const absolute = outPath.startsWith("/") ? outPath : `${io.cwd}/${outPath}`;
    await mkdir(dirname(absolute), {recursive: true});
    await writeFile(absolute, content.endsWith("\n") ? content : `${content}\n`, "utf8");
    if (json) {
      printJson(io, {ok: true, path: absolute, ...extra});
    } else {
      io.stdout(`Wrote ${absolute}`);
    }
    return 0;
  }
  if (json) {
    printJson(io, {content, ok: true, ...extra});
  } else {
    io.stdout(content);
  }
  return 0;
};
