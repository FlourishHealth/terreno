/**
 * Pre-downloads the MongoDB binary used by mongodb-memory-server.
 *
 * Usage: bun ./src/mongo/ensureMongoBinary.ts
 */
export const ensureMongoBinary = async (): Promise<void> => {
  if (process.env.CI) {
    console.info("[ensureMongoBinary] Skipping on CI (using external MongoDB when configured)");
    return;
  }

  const {MongoBinary} = await import("mongodb-memory-server-core");

  const startTime = Date.now();
  console.info("[ensureMongoBinary] Ensuring MongoDB binary is downloaded and cached...");

  const binaryPath = await MongoBinary.getPath();
  const elapsed = Date.now() - startTime;

  console.info(`[ensureMongoBinary] MongoDB binary ready at: ${binaryPath} (${elapsed}ms)`);
};

if (require.main === module) {
  void ensureMongoBinary();
}
