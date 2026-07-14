import {describe, expect, it} from "bun:test";

import {
  AES_GCM_ENVELOPE_VERSION,
  createAesGcmCodec,
  getSubtleCrypto,
  PayloadIntegrityError,
  UnknownEnvelopeVersionError,
} from "./aesGcmCodec";
import {identityCodec} from "./identityCodec";

const generateKey = (): Promise<CryptoKey> =>
  crypto.subtle.generateKey({length: 256, name: "AES-GCM"}, false, ["encrypt", "decrypt"]);

describe("createAesGcmCodec", () => {
  it("round-trips plaintext including unicode", async () => {
    const codec = createAesGcmCodec({key: await generateKey()});
    const plaintext = JSON.stringify({emoji: "🔐", note: "héllo wörld", value: 42});
    const payload = await codec.encode(plaintext);
    expect(payload).toBeInstanceOf(Uint8Array);
    expect(await codec.decode(payload)).toBe(plaintext);
  });

  it("writes the versioned envelope: version byte + 12-byte IV + ciphertext", async () => {
    const codec = createAesGcmCodec({key: await generateKey()});
    const payload = await codec.encode("x");
    expect(payload[0]).toBe(AES_GCM_ENVELOPE_VERSION);
    // 1 version + 12 IV + 1 plaintext byte + 16 GCM tag
    expect(payload.length).toBe(1 + 12 + 1 + 16);
  });

  it("never exposes plaintext in the payload bytes", async () => {
    const codec = createAesGcmCodec({key: await generateKey()});
    const payload = await codec.encode("SECRET_MARKER_XYZ");
    const asLatin1 = String.fromCharCode(...payload);
    expect(asLatin1).not.toContain("SECRET_MARKER_XYZ");
  });

  it("uses a fresh IV per encryption (distinct payloads for identical plaintext)", async () => {
    const codec = createAesGcmCodec({key: await generateKey()});
    const a = await codec.encode("same plaintext");
    const b = await codec.encode("same plaintext");
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(Buffer.from(a.subarray(1, 13)).equals(Buffer.from(b.subarray(1, 13)))).toBe(false);
    expect(await codec.decode(a)).toBe("same plaintext");
    expect(await codec.decode(b)).toBe("same plaintext");
  });

  it("throws PayloadIntegrityError on a tampered ciphertext byte", async () => {
    const codec = createAesGcmCodec({key: await generateKey()});
    const payload = await codec.encode("important data");
    payload[payload.length - 1] = (payload[payload.length - 1] as number) ^ 0xff;
    expect(codec.decode(payload)).rejects.toBeInstanceOf(PayloadIntegrityError);
  });

  it("throws PayloadIntegrityError when decrypting with the wrong key", async () => {
    const codecA = createAesGcmCodec({key: await generateKey()});
    const codecB = createAesGcmCodec({key: await generateKey()});
    const payload = await codecA.encode("important data");
    expect(codecB.decode(payload)).rejects.toBeInstanceOf(PayloadIntegrityError);
  });

  it("throws UnknownEnvelopeVersionError for an unknown version byte", async () => {
    const codec = createAesGcmCodec({key: await generateKey()});
    const payload = await codec.encode("important data");
    payload[0] = 9;
    const error = await codec.decode(payload).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnknownEnvelopeVersionError);
    // Distinguishable from tampering so callers can branch on the failure mode.
    expect(error).not.toBeInstanceOf(PayloadIntegrityError);
    expect((error as Error).message).toContain("9");
  });

  it("throws PayloadIntegrityError for an empty payload", async () => {
    const codec = createAesGcmCodec({key: await generateKey()});
    expect(codec.decode(new Uint8Array(0))).rejects.toBeInstanceOf(PayloadIntegrityError);
  });

  it("throws PayloadIntegrityError for a truncated payload", async () => {
    const codec = createAesGcmCodec({key: await generateKey()});
    const payload = await codec.encode("important data");
    expect(codec.decode(payload.subarray(0, 10))).rejects.toBeInstanceOf(PayloadIntegrityError);
  });
});

describe("identityCodec", () => {
  it("round-trips without encryption", async () => {
    const payload = await identityCodec.encode("plain ✨ text");
    expect(payload).toBeInstanceOf(Uint8Array);
    expect(await identityCodec.decode(payload)).toBe("plain ✨ text");
  });

  it("stores the plaintext bytes verbatim (opt-out of encryption)", async () => {
    const payload = await identityCodec.encode("visible");
    expect(new TextDecoder().decode(payload)).toBe("visible");
  });
});

describe("getSubtleCrypto", () => {
  it("returns the platform SubtleCrypto when available", () => {
    expect(getSubtleCrypto()).toBe(crypto.subtle);
  });
});
