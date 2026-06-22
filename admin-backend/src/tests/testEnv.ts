/**
 * Preload before `api/src/tests/bunSetup.ts` so admin-backend tests use
 * mongodb-memory-server (see TERRENO_TEST_USE_MEMORY_MONGO in that file).
 */
process.env.TERRENO_TEST_USE_MEMORY_MONGO = "true";
