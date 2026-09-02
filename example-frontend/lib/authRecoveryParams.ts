/**
 * Parse one-time auth recovery tokens from a reset or verify URL query string.
 */
export const parseAuthTokenFromSearch = (search: string): string | undefined => {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const token = new URLSearchParams(query).get("token")?.trim();
  if (!token) {
    return undefined;
  }
  return token;
};

export const parseAuthTokenFromRouteParam = (
  raw: string | string[] | undefined
): string | undefined => {
  if (typeof raw === "string") {
    return parseAuthTokenFromSearch(`token=${encodeURIComponent(raw)}`);
  }
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    return parseAuthTokenFromSearch(`token=${encodeURIComponent(raw[0])}`);
  }
  return undefined;
};
