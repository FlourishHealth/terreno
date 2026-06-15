import type {APIRequestContext} from "@playwright/test";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export interface GeneratedConsentLink {
  _id: string;
  expiresAt: string;
  token: string;
  url: string;
}

/**
 * Signs up (idempotently) and logs in a user, returning their userId. Used to
 * obtain the target user a signed consent link is generated for.
 */
export const signupAndGetUserId = async (
  request: APIRequestContext,
  user: {email: string; name: string; password: string}
): Promise<string> => {
  await request.post(`${API_URL}/auth/signup`, {data: user});
  const loginRes = await request.post(`${API_URL}/auth/login`, {
    data: {email: user.email, password: user.password},
  });
  if (!loginRes.ok()) {
    throw new Error(`Failed to login as ${user.email}`);
  }
  const loginData = (await loginRes.json()) as {data?: {userId?: string}};
  return loginData?.data?.userId ?? "";
};

/**
 * Generates a signed consent link for a user via the admin endpoint.
 */
export const generateConsentLink = async (
  request: APIRequestContext,
  adminToken: string,
  body: {userId: string; consentFormIds?: string[]; expiresIn?: string; maxUses?: number}
): Promise<GeneratedConsentLink> => {
  const res = await request.post(`${API_URL}/consents/links`, {
    data: body,
    headers: {authorization: `Bearer ${adminToken}`},
  });
  if (!res.ok()) {
    throw new Error(`Failed to generate consent link: ${JSON.stringify(await res.json())}`);
  }
  const json = (await res.json()) as {data?: GeneratedConsentLink};
  if (!json.data?.token) {
    throw new Error("Consent link response did not include a token");
  }
  return json.data;
};

/**
 * Returns the number of consent responses recorded for a user (admin audit).
 */
export const getAuditResponseCount = async (
  request: APIRequestContext,
  adminToken: string,
  userId: string
): Promise<number> => {
  const res = await request.get(`${API_URL}/consents/audit/${userId}`, {
    headers: {authorization: `Bearer ${adminToken}`},
  });
  if (!res.ok()) {
    return 0;
  }
  const json = (await res.json()) as {data?: unknown[]};
  return json.data?.length ?? 0;
};
