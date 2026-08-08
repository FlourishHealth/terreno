/** Lightweight logger for @terreno/test internals (avoids importing @terreno/api). */
export const testLogger = {
  catch: (error: unknown): void => {
    if (process.env.DEBUG_MONGO_PRELOAD === "true" || process.env.SHOW_ALL_TEST_LOGS === "true") {
      console.error(error);
    }
  },
  debug: (message: string): void => {
    if (process.env.DEBUG_MONGO_PRELOAD === "true") {
      console.debug(message);
    }
  },
  info: (message: string): void => {
    console.info(message);
  },
  warn: (message: string): void => {
    console.warn(message);
  },
};
