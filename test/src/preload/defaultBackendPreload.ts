import {registerSimpleMongoPreload} from "./registerBackendPreload";

registerSimpleMongoPreload({
  testEnv: {
    tokenIssuer: "terreno-api.test",
  },
});
