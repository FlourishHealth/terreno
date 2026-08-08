import {main} from "./generate-roadmap/check.ts";

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
