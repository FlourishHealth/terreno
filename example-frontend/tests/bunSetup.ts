import "../../ui/src/bunSetup";
import {mock} from "bun:test";
import {summarizeExampleTextMock, todoSummaryTestState} from "./todoSummaryTestState";

const expoGlobal = globalThis.expo as typeof globalThis.expo & {
  modules?: Record<string, unknown>;
};
expoGlobal.modules = {
  ...expoGlobal.modules,
  ExpoSecureStore: {
    deleteValueWithKeyAsync: async (): Promise<void> => undefined,
    getValueWithKeyAsync: async (): Promise<null> => null,
    setValueWithKeyAsync: async (): Promise<void> => undefined,
  },
};

const uiModule = await import("@terreno/ui");
mock.module("@terreno/ui", () => ({
  ...uiModule,
  useStoredState: () =>
    ["", async (): Promise<void> => undefined, false] as [
      string,
      (value: string | undefined) => Promise<void>,
      boolean,
    ],
}));

const sdkMock = {
  useSummarizeExampleTextMutation: () => [summarizeExampleTextMock, {isLoading: false}],
};
const syncDbSdkMock = {
  useTodos: () => ({data: todoSummaryTestState.todos}),
};

mock.module("@/store/sdk", () => sdkMock);
mock.module("../store/sdk", () => sdkMock);
mock.module(`${process.cwd()}/store/sdk.ts`, () => sdkMock);
mock.module("@/store/syncDbSdk", () => syncDbSdkMock);
mock.module("../store/syncDbSdk", () => syncDbSdkMock);
mock.module(`${process.cwd()}/store/syncDbSdk.ts`, () => syncDbSdkMock);
