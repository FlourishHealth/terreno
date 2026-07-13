export interface ApiBaseUrlOptions {
  envApiUrl?: string;
  expoExtra?: {
    BASE_URL?: string;
    apiBaseUrl?: string;
  };
}

/**
 * Resolves the API URL embedded in the frontend bundle. Deployment automation updates
 * `BASE_URL`, so it takes precedence over the development-only `apiBaseUrl` fallback.
 */
export const resolveApiBaseUrl = ({envApiUrl, expoExtra}: ApiBaseUrlOptions): string =>
  envApiUrl ?? expoExtra?.BASE_URL ?? expoExtra?.apiBaseUrl ?? "http://localhost:4000";
