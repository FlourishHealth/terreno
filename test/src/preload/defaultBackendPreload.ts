import {registerBackendPreload} from "./registerBackendPreload";

process.env.DEBUG_MONGO_PRELOAD = "true";

registerBackendPreload({
  mongo: {useReplSet: true},
  testEnv: {
    tokenIssuer: "terreno-api.test",
  },
});
