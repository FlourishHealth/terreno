/**
 * Encryption primitives for at-rest protection of persisted data. Encryption is
 * applied at the persistence boundary (the serialized blob), keeping the
 * in-memory store plaintext for querying while ciphertext is what lands in
 * SQLite/localStorage.
 */

/** Symmetric codec applied to the serialized store blob before persistence. */
export interface PayloadCodec {
  /** Encrypt/encode a plaintext string for storage. */
  encode(plaintext: string): Promise<string>;
  /** Decrypt/decode a previously encoded string. */
  decode(ciphertext: string): Promise<string>;
}

/** Resolves the symmetric key used by a codec (e.g. from secure storage). */
export type KeyProvider = () => Promise<CryptoKey>;
