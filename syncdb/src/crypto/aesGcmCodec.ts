import type {KeyProvider, PayloadCodec} from "./types";

const IV_BYTES = 12;
const ENVELOPE_SEPARATOR = ".";

const toBase64 = (bytes: Uint8Array): string => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const fromBase64 = (value: string): Uint8Array => {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// Newer TS DOM libs type `BufferSource` as ArrayBuffer-backed, while
// `Uint8Array` is `ArrayBufferLike`-backed; this bridges the mismatch.
const asBufferSource = (bytes: Uint8Array): BufferSource => bytes as unknown as BufferSource;

const getSubtle = (): SubtleCrypto => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto SubtleCrypto is unavailable in this environment");
  }
  return subtle;
};

/** Generate a fresh extractable AES-GCM 256-bit key. */
export const generateAesGcmKey = async (): Promise<CryptoKey> =>
  getSubtle().generateKey({length: 256, name: "AES-GCM"}, true, ["encrypt", "decrypt"]);

/** Export an AES-GCM key to a base64 raw string for secure storage. */
export const exportAesGcmKeyToBase64 = async (key: CryptoKey): Promise<string> => {
  const raw = await getSubtle().exportKey("raw", key);
  return toBase64(new Uint8Array(raw));
};

/** Import an AES-GCM key from a base64 raw string. */
export const importAesGcmKeyFromBase64 = async (value: string): Promise<CryptoKey> =>
  getSubtle().importKey("raw", asBufferSource(fromBase64(value)), {name: "AES-GCM"}, true, [
    "encrypt",
    "decrypt",
  ]);

/** Build a key provider that always returns the same key instance. */
export const createStaticKeyProvider = (key: CryptoKey): KeyProvider => {
  return async (): Promise<CryptoKey> => key;
};

/**
 * AES-GCM payload codec. Encodes as `base64(iv).base64(ciphertext)` with a fresh
 * random IV per encryption.
 */
export const createAesGcmCodec = ({keyProvider}: {keyProvider: KeyProvider}): PayloadCodec => {
  const encode = async (plaintext: string): Promise<string> => {
    const subtle = getSubtle();
    const key = await keyProvider();
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertext = await subtle.encrypt(
      {iv: asBufferSource(iv), name: "AES-GCM"},
      key,
      asBufferSource(new TextEncoder().encode(plaintext))
    );
    return `${toBase64(iv)}${ENVELOPE_SEPARATOR}${toBase64(new Uint8Array(ciphertext))}`;
  };

  const decode = async (ciphertext: string): Promise<string> => {
    const [ivB64, dataB64] = ciphertext.split(ENVELOPE_SEPARATOR);
    if (!ivB64 || !dataB64) {
      throw new Error("Invalid AES-GCM envelope");
    }
    const subtle = getSubtle();
    const key = await keyProvider();
    const plaintext = await subtle.decrypt(
      {iv: asBufferSource(fromBase64(ivB64)), name: "AES-GCM"},
      key,
      asBufferSource(fromBase64(dataB64))
    );
    return new TextDecoder().decode(plaintext);
  };

  return {decode, encode};
};
