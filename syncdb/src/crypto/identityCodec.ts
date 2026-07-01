import type {PayloadCodec} from "./types";

/** No-op codec (default). Use a real codec to enable encryption at rest. */
export const identityCodec: PayloadCodec = {
  decode: async (ciphertext: string): Promise<string> => ciphertext,
  encode: async (plaintext: string): Promise<string> => plaintext,
};
