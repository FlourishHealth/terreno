import type {PayloadCodec} from "./types";

/**
 * No-op codec: UTF-8 bytes with no encryption. For tests and explicit opt-out
 * of encryption at rest; never the default on web.
 */
export const identityCodec: PayloadCodec = {
  decode: async (payload: Uint8Array): Promise<string> => new TextDecoder().decode(payload),
  encode: async (plaintext: string): Promise<Uint8Array> => new TextEncoder().encode(plaintext),
};
