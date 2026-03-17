import {Langfuse} from "langfuse";

import type {LangfuseAppOptions} from "./langfuseTypes";

let langfuseInstance: Langfuse | null = null;

export const initLangfuseClient = (options: LangfuseAppOptions): Langfuse => {
  langfuseInstance = new Langfuse({
    baseUrl: options.baseUrl ?? "https://cloud.langfuse.com",
    flushAt: 1,
    publicKey: options.publicKey,
    secretKey: options.secretKey,
    ...(options.projectId ? {_projectId: options.projectId} : {}),
  });
  return langfuseInstance;
};

export const getLangfuseClient = (): Langfuse => {
  if (!langfuseInstance) {
    throw new Error("Langfuse client not initialized. Call initLangfuseClient first.");
  }
  return langfuseInstance;
};

export const isLangfuseInitialized = (): boolean => langfuseInstance != null;

export const shutdownLangfuseClient = async (): Promise<void> => {
  if (langfuseInstance) {
    await langfuseInstance.flushAsync();
    langfuseInstance = null;
  }
};
