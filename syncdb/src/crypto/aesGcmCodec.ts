import type {PayloadCodec} from "./types";

/**
 * Envelope layout (binary): `[1 version byte][12-byte IV][ciphertext + GCM tag]`.
 * The version byte lets future envelope changes (new cipher, KDF, chunking)
 * coexist with already-persisted blobs.
 */
export const AES_GCM_ENVELOPE_VERSION = 1;

const IV_BYTES = 12;
/** AES-GCM appends a 16-byte authentication tag to every ciphertext. */
const GCM_TAG_BYTES = 16;

/** Thrown when a persisted payload declares an envelope version this build cannot read. */
export class UnknownEnvelopeVersionError extends Error {
  constructor(version: number) {
    super(`Unknown syncdb payload envelope version: ${version}`);
    this.name = "UnknownEnvelopeVersionError";
  }
}

/**
 * Thrown when a payload is truncated or fails AES-GCM authentication (tampered
 * ciphertext, wrong key, or corrupt storage).
 */
export class PayloadIntegrityError extends Error {
  constructor(message: string, options?: {cause?: unknown}) {
    super(message, options);
    this.name = "PayloadIntegrityError";
  }
}

// Newer TS DOM libs type `BufferSource` as ArrayBuffer-backed while `Uint8Array`
// is `ArrayBufferLike`-backed; this bridges the mismatch for WebCrypto calls.
const asBufferSource = (bytes: Uint8Array): BufferSource => bytes as unknown as BufferSource;

/** WebCrypto SubtleCrypto, or a loud failure on platforms without it. */
export const getSubtleCrypto = (): SubtleCrypto => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto SubtleCrypto is unavailable in this environment");
  }
  return subtle;
};

/**
 * AES-256-GCM payload codec over WebCrypto. Every encode uses a fresh random
 * 12-byte IV; the result is a versioned binary envelope. Decode distinguishes
 * unknown envelope versions ({@link UnknownEnvelopeVersionError}) from
 * tampered/undecryptable payloads ({@link PayloadIntegrityError}) so callers
 * can react differently (migration vs. wipe-and-rebootstrap).
 */
export const createAesGcmCodec = ({key}: {key: CryptoKey}): PayloadCodec => {
  const encode = async (plaintext: string): Promise<Uint8Array> => {
    const subtle = getSubtleCrypto();
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertext = new Uint8Array(
      await subtle.encrypt(
        {iv: asBufferSource(iv), name: "AES-GCM"},
        key,
        asBufferSource(new TextEncoder().encode(plaintext))
      )
    );
    const envelope = new Uint8Array(1 + IV_BYTES + ciphertext.length);
    envelope[0] = AES_GCM_ENVELOPE_VERSION;
    envelope.set(iv, 1);
    envelope.set(ciphertext, 1 + IV_BYTES);
    return envelope;
  };

  const decode = async (payload: Uint8Array): Promise<string> => {
    if (payload.length === 0) {
      throw new PayloadIntegrityError("Empty payload");
    }
    if (payload[0] !== AES_GCM_ENVELOPE_VERSION) {
      throw new UnknownEnvelopeVersionError(payload[0] as number);
    }
    if (payload.length < 1 + IV_BYTES + GCM_TAG_BYTES) {
      throw new PayloadIntegrityError("Truncated payload");
    }
    const subtle = getSubtleCrypto();
    const iv = payload.subarray(1, 1 + IV_BYTES);
    const ciphertext = payload.subarray(1 + IV_BYTES);
    let plaintext: ArrayBuffer;
    try {
      plaintext = await subtle.decrypt(
        {iv: asBufferSource(iv), name: "AES-GCM"},
        key,
        asBufferSource(ciphertext)
      );
    } catch (error) {
      throw new PayloadIntegrityError("Payload failed AES-GCM authentication", {cause: error});
    }
    return new TextDecoder().decode(plaintext);
  };

  return {decode, encode};
};
