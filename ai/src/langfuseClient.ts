import {LangfuseClient} from "@langfuse/client";

import type {LangfuseAppOptions} from "./langfuseTypes";

let langfuseInstance: LangfuseClient | null = null;
let langfuseOptions: LangfuseAppOptions | null = null;

export const initLangfuseClient = (options: LangfuseAppOptions): LangfuseClient => {
  langfuseOptions = options;
  langfuseInstance = new LangfuseClient({
    baseUrl: options.baseUrl ?? "https://cloud.langfuse.com",
    publicKey: options.publicKey,
    secretKey: options.secretKey,
  });
  return langfuseInstance;
};

export const getLangfuseClient = (): LangfuseClient => {
  if (!langfuseInstance) {
    throw new Error("Langfuse client not initialized. Call initLangfuseClient first.");
  }
  return langfuseInstance;
};

export const isLangfuseInitialized = (): boolean => langfuseInstance != null;

export const getLangfuseOptions = (): LangfuseAppOptions | null => langfuseOptions;

export const shutdownLangfuseClient = async (): Promise<void> => {
  if (langfuseInstance) {
    await langfuseInstance.shutdown();
    langfuseInstance = null;
    langfuseOptions = null;
  }
};
