import {resolve} from "node:path";
import {validateLifecyclePlugin} from "./lifecycleSkills.ts";

const errors = validateLifecyclePlugin({rootDirectory: resolve(import.meta.dir, "../..")});

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.info("Lifecycle skills: canonical, portable, transition-safe, and loop-compatible.");

