import {beforeEach} from "bun:test";
import {registerSimpleMongoPreload} from "@terreno/test";

process.env.TERRENO_TEST_USE_MEMORY_MONGO = "true";

registerSimpleMongoPreload({
  testEnv: {
    tokenIssuer: "terreno-comms.test",
  },
});

beforeEach((): void => {
  process.env.NODE_ENV = "test";
  Reflect.deleteProperty(process.env, "SENDGRID_API_KEY");
});
