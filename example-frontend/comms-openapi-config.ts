import type {ConfigFile} from "@rtk-query/codegen-openapi";

// Communications is generated independently so its new API surface can be verified
// without rewriting the established full-stack SDK contracts used by existing screens.
const config: ConfigFile = {
  apiFile: "@terreno/rtk",
  apiImport: "emptySplitApi",
  argSuffix: "Args",
  exportName: "commsOpenapi",
  filterEndpoints: /Comms/,
  flattenArg: true,
  hooks: true,
  outputFile: "./store/commsOpenApiSdk.ts",
  responseSuffix: "Res",
  schemaFile: process.env.OPENAPI_URL ?? "http://localhost:4000/openapi.json",
  tag: true,
  useUnknown: true,
};

export default config;
