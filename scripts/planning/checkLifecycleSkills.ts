import {resolve} from "node:path";
import {validateLifecyclePlugin} from "./lifecycleSkills.ts";
import {syncClaudePlugin} from "./syncClaudePlugin.ts";
import {syncInstallableSkills} from "./syncInstallableSkills.ts";

const rootDirectory = resolve(import.meta.dir, "../..");
const errors = [
  ...validateLifecyclePlugin({rootDirectory}),
  ...syncInstallableSkills({check: true, rootDirectory}),
  ...syncClaudePlugin({check: true, rootDirectory}),
];

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.info(
  "Lifecycle skills: canonical, portable, transition-safe, loop-compatible, and installable."
);
