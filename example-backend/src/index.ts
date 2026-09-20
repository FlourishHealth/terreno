import "./instrument";
import {logger} from "@terreno/api";

import {start} from "./server";

start().catch((error: unknown): void => {
  logger.error(`Server start failed: ${error}`);
  process.exit(1);
});
