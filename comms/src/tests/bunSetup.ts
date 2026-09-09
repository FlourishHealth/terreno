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
  Reflect.deleteProperty(process.env, "TWILIO_ACCOUNT_SID");
  Reflect.deleteProperty(process.env, "TWILIO_AUTH_TOKEN");
  Reflect.deleteProperty(process.env, "TWILIO_FROM_NUMBER");
  Reflect.deleteProperty(process.env, "TWILIO_MESSAGING_SERVICE_SID");
  Reflect.deleteProperty(process.env, "TWILIO_VERIFY_SERVICE_SID");
});
