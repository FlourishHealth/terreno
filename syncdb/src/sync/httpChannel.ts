import type {
  AuthProvider,
  SyncAck,
  SyncMutateRequest,
  SyncNack,
  SyncSnapshotResponse,
} from "../types";
import type {SendMutationResult} from "./transport";

/**
 * Thrown when the server answers 401: the bearer token is missing or expired.
 * Distinguishable from ordinary transport errors so callers can pause and wait
 * for the next auth change instead of retrying with the same dead token.
 */
export class AuthRequiredError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export interface FetchSnapshotPageArgs {
  collection: string;
  /** Resume cursor (highest seq already applied); 0 = from the beginning. */
  cursor: number;
  /** Page size; server default applies when omitted. */
  limit?: number;
}

/**
 * HTTP side of the sync protocol: snapshot paging for bootstrap/reconcile and
 * the `POST /sync/mutate` fallback used when the socket is unavailable.
 */
export interface HttpChannel {
  fetchSnapshotPage: (args: FetchSnapshotPageArgs) => Promise<SyncSnapshotResponse>;
  /**
   * POST the mutation; 200 resolves `{type: "ack"}`, nack statuses
   * (409/403/422/500 with a `{nack}` body) resolve `{type: "nack"}`, 401
   * rejects with {@link AuthRequiredError}, anything else rejects.
   */
  sendMutation: (request: SyncMutateRequest) => Promise<SendMutationResult>;
  /**
   * Fetch the caller's per-user key material from `GET /sync/key` — feeds the
   * default server-derived encryption KeyProvider.
   */
  fetchKeyMaterial: () => Promise<string>;
}

/** Minimal fetch signature (global fetch is assignable; tests inject stubs). */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpChannelConfig {
  /** Server origin, e.g. "http://localhost:4000". */
  baseUrl: string;
  /** Token source; `getToken()` is called fresh on every request (never cached). */
  authProvider: Pick<AuthProvider, "getToken">;
  /** Fetch implementation override for tests/SSR (defaults to global fetch). */
  fetchImpl?: FetchLike;
}

/** Create an {@link HttpChannel} speaking @terreno/api's `/sync/*` routes. */
export const createHttpChannel = ({
  baseUrl,
  authProvider,
  fetchImpl,
}: HttpChannelConfig): HttpChannel => {
  const fetcher: FetchLike = fetchImpl ?? ((input, init) => globalThis.fetch(input, init));

  const request = async (path: string, init?: RequestInit): Promise<Response> => {
    const token = await authProvider.getToken();
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(init?.body !== undefined ? {"Content-Type": "application/json"} : {}),
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
    };
    const response = await fetcher(`${baseUrl}${path}`, {...init, headers});
    if (response.status === 401) {
      throw new AuthRequiredError(`401 from ${path}`);
    }
    return response;
  };

  const fetchSnapshotPage = async ({
    collection,
    cursor,
    limit,
  }: FetchSnapshotPageArgs): Promise<SyncSnapshotResponse> => {
    const query = new URLSearchParams({collection, cursor: String(cursor)});
    if (limit !== undefined) {
      query.set("limit", String(limit));
    }
    const response = await request(`/sync/snapshot?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`Snapshot request for ${collection} failed with status ${response.status}`);
    }
    return (await response.json()) as SyncSnapshotResponse;
  };

  const sendMutation = async (mutation: SyncMutateRequest): Promise<SendMutationResult> => {
    const response = await request("/sync/mutate", {
      body: JSON.stringify(mutation),
      method: "POST",
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error(`Sync mutate returned a non-JSON response (status ${response.status})`);
    }
    const parsed = body as {ack?: SyncAck; nack?: SyncNack};
    if (response.ok && parsed.ack) {
      return {ack: parsed.ack, type: "ack"};
    }
    if (parsed.nack) {
      return {nack: parsed.nack, type: "nack"};
    }
    throw new Error(`Sync mutate failed with status ${response.status}`);
  };

  const fetchKeyMaterial = async (): Promise<string> => {
    const response = await request("/sync/key");
    if (!response.ok) {
      throw new Error(`Sync key request failed with status ${response.status}`);
    }
    const body = (await response.json()) as {keyMaterial?: string};
    if (!body.keyMaterial) {
      throw new Error("Sync key response is missing keyMaterial");
    }
    return body.keyMaterial;
  };

  return {fetchKeyMaterial, fetchSnapshotPage, sendMutation};
};
