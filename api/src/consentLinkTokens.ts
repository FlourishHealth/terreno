/**
 * Pure helpers for generating and hashing signed consent link tokens.
 *
 * A link carries a high-entropy random token in its URL. We never persist the
 * raw token; only its SHA-256 hash is stored on the ConsentLink document. To
 * validate an incoming token we hash it and look the link up by hash.
 */
import {createHash, randomBytes} from "node:crypto";

/**
 * Generates a URL-safe, high-entropy raw token for a signed consent link.
 * The raw token is returned to the caller exactly once (at creation time) and
 * is never stored.
 */
export const generateConsentLinkToken = (): string => {
  return randomBytes(32).toString("base64url");
};

/**
 * Hashes a raw consent link token with SHA-256. Deterministic so an incoming
 * token can be hashed and matched against the stored `tokenHash`.
 */
export const hashConsentLinkToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};
