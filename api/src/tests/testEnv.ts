/** Use in-memory MongoDB when no external test URI is configured (local / CI without mongod). */
if (!process.env.TERRENO_TEST_MONGODB_URI?.trim()) {
  process.env.TERRENO_TEST_USE_MEMORY_MONGO = "true";
}
