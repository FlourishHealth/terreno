import {Configuration} from "./models/configuration";

// Application constants
Configuration.register("APP_NAME", {
  defaultValue: "Terreno Example",
  description: "Application name",
  type: "string",
});

Configuration.register("DEFAULT_PAGE_SIZE", {
  defaultValue: 20,
  description: "Default pagination page size",
  type: "number",
});

Configuration.register("MAX_PAGE_SIZE", {
  defaultValue: 100,
  description: "Maximum pagination page size",
  type: "number",
});

// Environment configurations
Configuration.register("NODE_ENV", {
  defaultValue: "development",
  description: "Node environment",
  envVar: "NODE_ENV",
  type: "string",
});

Configuration.register("APP_ENV", {
  defaultValue: "development",
  description: "Application environment",
  envVar: "APP_ENV",
  type: "string",
});

Configuration.register("BACKEND_SERVICE", {
  defaultValue: "all",
  description: "Backend service type (api, websockets, tasks, all)",
  envVar: "BACKEND_SERVICE",
  type: "string",
});

Configuration.register("PR_NUMBER", {
  description: "Pull request number",
  envVar: "PR_NUMBER",
  type: "string",
});

Configuration.register("API_URL", {
  description: "API service URL",
  envVar: "API_URL",
  type: "string",
});

Configuration.register("TASKS_URL", {
  description: "Tasks service URL",
  envVar: "TASKS_URL",
  type: "string",
});

Configuration.register("WEBSOCKETS_DEBUG", {
  defaultValue: false,
  description: "Enable websockets debug logging",
  envVar: "WEBSOCKETS_DEBUG",
  type: "boolean",
});

Configuration.register("PR_SERVICE_URL", {
  defaultValue: "EXAMPLE-ue.a.run.app",
  description: "Cloud run service URL for PR environments",
  type: "string",
});

// ============================================================================
// Exported convenience getters (backward compatibility)
// ============================================================================

export const APP_NAME = Configuration.get<string>("APP_NAME");
export const DEFAULT_PAGE_SIZE = Configuration.get<number>("DEFAULT_PAGE_SIZE");
export const MAX_PAGE_SIZE = Configuration.get<number>("MAX_PAGE_SIZE");

export const isProduction =
  Configuration.get<string>("NODE_ENV") === "production" &&
  Configuration.get<string>("APP_ENV") === "production";

export const isStaging = Configuration.get<string>("APP_ENV") === "staging";

// This is used to determine if the app is deployed to Cloud Run in production or staging or
// running locally.
export const isDeployed = Configuration.get<string>("NODE_ENV") === "production";
export const isDev = Configuration.get<string>("NODE_ENV") === "development";
export const isTest = Configuration.get<string>("NODE_ENV") === "test";

export const isWebsocketService =
  Configuration.get<string>("BACKEND_SERVICE") === "websockets" ||
  Configuration.get<string>("BACKEND_SERVICE") === "all";

// During migration, API service will accept websockets connections but only the websocket
// service should listen to changes. Also applies to all, for dev/pr.
export const isTasksService =
  Configuration.get<string>("BACKEND_SERVICE") === "tasks" ||
  Configuration.get<string>("BACKEND_SERVICE") === "all";

export const isApiService =
  Configuration.get<string>("BACKEND_SERVICE") === "api" ||
  Configuration.get<string>("BACKEND_SERVICE") === "all";

export const getEnvironment = (): string => {
  if (isProduction) {
    return "PROD";
  }
  if (isStaging) {
    const prNumber = Configuration.get<string>("PR_NUMBER");
    return prNumber ? `STG-${prNumber}` : "STG";
  }
  if (isDev) {
    return "DEV";
  }
  if (isTest) {
    return "TEST";
  }
  return "DEV"; // Default fallback
};

// Calculate URLs based on PR environment
const PR_SERVICE_URL = Configuration.get<string>("PR_SERVICE_URL");
export const isPullRequest =
  Configuration.get<string>("PR_NUMBER") && Configuration.get<string>("PR_NUMBER") !== "staging";

let API_URL = Configuration.get<string>("API_URL");
let TASKS_URL = Configuration.get<string>("TASKS_URL");

if (isPullRequest) {
  const prNumber = Configuration.get<string>("PR_NUMBER");
  API_URL = `https://pr-${prNumber}---${PR_SERVICE_URL}`;
  // Tasks run on the same instance in PR.
  TASKS_URL = API_URL;
}

export {API_URL, TASKS_URL};

export const WEBSOCKETS_DEBUG = Configuration.get<boolean>("WEBSOCKETS_DEBUG");
