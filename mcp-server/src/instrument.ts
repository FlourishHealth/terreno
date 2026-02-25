import * as Sentry from "@sentry/bun";

if (process.env.NODE_ENV === "production" && !process.env.SENTRY_DSN) {
  throw new Error("SENTRY_DSN must be set in production");
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.APP_ENV ?? "development",
  tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
    ? Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE)
    : 0.1,
});
