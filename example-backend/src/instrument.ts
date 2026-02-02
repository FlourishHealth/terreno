// Add our custom DateOnly type to mongoose as early as possible
import {DateOnly} from "@terreno/api";
import mongoose from "mongoose";

(mongoose.Schema.Types as any).DateOnly = DateOnly;

// Initialize OpenTelemetry first - must be before any other imports
import {TraceExporter} from "@google-cloud/opentelemetry-cloud-trace-exporter";
// Initialize Google Cloud Trace agent for compatibility
import {start as startTrace} from "@google-cloud/trace-agent";
import {ExpressInstrumentation} from "@opentelemetry/instrumentation-express";
import {HttpInstrumentation} from "@opentelemetry/instrumentation-http";
import {MongooseInstrumentation} from "@opentelemetry/instrumentation-mongoose";
import {resourceFromAttributes} from "@opentelemetry/resources";
import {NodeSDK} from "@opentelemetry/sdk-node";
import {SemanticResourceAttributes} from "@opentelemetry/semantic-conventions";

// Initialize OpenTelemetry SDK with comprehensive instrumentation
const isTracingEnabled = process.env.NODE_ENV === "production";
const serviceName = process.env.FLOURISH_SERVICE || "flourish-backend";
const serviceVersion = process.env.npm_package_version || "1.0.0";

if (isTracingEnabled) {
  const sdk = new NodeSDK({
    instrumentations: [
      // HTTP instrumentation for incoming requests
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req): boolean => {
          // Ignore health checks and static assets
          return (
            req.url?.includes("/health") ||
            req.url?.includes("/socket.io/") ||
            req.url?.includes("/openapi.json") ||
            false
          );
        },
      }),
      // Express instrumentation for route-level tracing
      new ExpressInstrumentation(),
      // Mongoose instrumentation for database operations
      new MongooseInstrumentation({
        // Enable response hook to capture query results metadata
        responseHook: (span, _responseInfo): void => {
          // Add basic operation metadata
          span.setAttributes({
            "db.operation.completed": true,
          });
        },
      }),
    ],
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.APP_ENV || "production",
    }),
    traceExporter: new TraceExporter({
      // Use default Google Cloud project and credentials
    }),
  });

  sdk.start();
  // Use logger instead of console in production, if you need to debug if this is working.
  // process.stdout.write("OpenTelemetry instrumentation initialized successfully\n");

  // Keep Google Cloud Trace agent for compatibility (disabled when OpenTelemetry is active)
  startTrace({
    // Configure buffer size for batching traces
    bufferSize: 1000,
    // Disable when OpenTelemetry is handling tracing
    enabled: false,
    // Ignore health check endpoints to reduce noise
    ignoreUrls: ["/health", "/health/", "/socket.io/", "/openapi.json"],
    // Set sampling rate (0.1 = 10% of requests)
    samplingRate: process.env.TRACE_SAMPLING_RATE
      ? Number.parseFloat(process.env.TRACE_SAMPLING_RATE)
      : 0.1,
  });
}

// Initialize Sentry after trace agent
import * as Sentry from "@sentry/node";

// import {nodeProfilingIntegration} from "@sentry/profiling-node";

if (process.env.NODE_ENV === "production" && !process.env.SENTRY_DSN) {
  throw new Error("SENTRY_DSN must be set");
}

const IGNORE_TRACES = ["health"];

// Ensure to call this before requiring any other modules!
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enableLogs: true,
  // debug: true,
  environment: process.env.APP_ENV ?? "development",
  ignoreErrors: [/^.*ECONNRESET*$/, /^.*socket hang up*$/],
  integrations: [
    // Only profile integration needs to be added, the rest are defaults and are already added,
    // including Express, mongoose, HTTP, etc. MongoDB/Mongoose instrumentation is automatic.
    // nodeProfilingIntegration(),
  ],
  profilesSampleRate: process.env.SENTRY_PROFILES_SAMPLE_RATE
    ? Number.parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE)
    : 0.1,
  tracesSampler: (samplingContext) => {
    const transactionName = samplingContext.name.toLowerCase();
    // ignore any transactions that include a match from the ignoreTraces list
    if (IGNORE_TRACES.some((trace) => transactionName.includes(trace.toLowerCase()))) {
      return 0.0;
    }
    // otherwise just use the standard sample rate
    return process.env.SENTRY_TRACES_SAMPLE_RATE
      ? Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0.1;
  },
});
