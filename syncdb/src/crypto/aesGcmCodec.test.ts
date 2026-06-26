import {describe, expect, it} from "bun:test";

import {
  createAesGcmCodec,
  createStaticKeyProvider,
  exportAesGcmKeyToBase64,
  generateAesGcmKey,
  importAesGcmKeyFromBase64,
} from "./aesGcmCodec";

describe("aesGcmCodec", () => {
  it("round-trips plaintext and does not store it in the clear", async () => {
    const key = await generateAesGcmKey();
    const codec = createAesGcmCodec({keyProvider: createStaticKeyProvider(key)});

    const plaintext = JSON.stringify({secret: "top-secret-value"});
    const ciphertext = await codec.encode(plaintext);

    expect(ciphertext).not.toContain("top-secret-value");
    expect(await codec.decode(ciphertext)).toBe(plaintext);
  });

  it("produces a different envelope each time (random IV)", async () => {
    const key = await generateAesGcmKey();
    const codec = createAesGcmCodec({keyProvider: createStaticKeyProvider(key)});

    const a = await codec.encode("same");
    const b = await codec.encode("same");
    expect(a).not.toBe(b);
    expect(await codec.decode(a)).toBe("same");
    expect(await codec.decode(b)).toBe("same");
  });

  it("fails to decode with the wrong key", async () => {
    const codec = createAesGcmCodec({
      keyProvider: createStaticKeyProvider(await generateAesGcmKey()),
    });
    const ciphertext = await codec.encode("payload");

    const otherCodec = createAesGcmCodec({
      keyProvider: createStaticKeyProvider(await generateAesGcmKey()),
    });
    await expect(otherCodec.decode(ciphertext)).rejects.toThrow();
  });

  it("rejects a malformed envelope", async () => {
    const codec = createAesGcmCodec({
      keyProvider: createStaticKeyProvider(await generateAesGcmKey()),
    });
    await expect(codec.decode("not-an-envelope")).rejects.toThrow();
  });

  it("exports and re-imports a key that can still decrypt", async () => {
    const key = await generateAesGcmKey();
    const codec = createAesGcmCodec({keyProvider: createStaticKeyProvider(key)});
    const ciphertext = await codec.encode("portable");

    const reimported = await importAesGcmKeyFromBase64(await exportAesGcmKeyToBase64(key));
    const reimportedCodec = createAesGcmCodec({keyProvider: createStaticKeyProvider(reimported)});
    expect(await reimportedCodec.decode(ciphertext)).toBe("portable");
  });
});
