import "./instrument";
import {start} from "./server";

start().catch((error: unknown) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
