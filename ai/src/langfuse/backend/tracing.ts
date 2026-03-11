import {LangfuseSpanProcessor} from "@langfuse/otel";
import {NodeSDK} from "@opentelemetry/sdk-node";
import {logger} from "@terreno/api";

import type {LangfuseAppOptions} from "./types";

let sdkInstance: NodeSDK | null = null;

export const initTracing = (options: LangfuseAppOptions): NodeSDK => {
  const sdk = new NodeSDK({
    serviceName: options.serviceName ?? "terreno-app",
    spanProcessors: [
      new LangfuseSpanProcessor({
        baseUrl: options.baseUrl ?? "https://cloud.langfuse.com",
        publicKey: options.publicKey,
        secretKey: options.secretKey,
      }),
    ],
  });

  sdk.start();
  sdkInstance = sdk;
  logger.info("Langfuse OpenTelemetry tracing initialized");
  return sdk;
};

export const shutdownTracing = async (): Promise<void> => {
  if (sdkInstance) {
    await sdkInstance.shutdown();
    sdkInstance = null;
    logger.info("Langfuse OpenTelemetry tracing shut down");
  }
};
