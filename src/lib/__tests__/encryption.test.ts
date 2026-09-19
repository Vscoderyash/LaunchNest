import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/encryption";

beforeAll(() => {
  // 32-byte test key, base64-encoded — never used outside this test run.
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext value", () => {
    const encrypted = encryptSecret("super-secret-api-key");
    expect(encrypted).not.toContain("super-secret-api-key");
    expect(decryptSecret(encrypted)).toBe("super-secret-api-key");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-value");
    const b = encryptSecret("same-value");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-value");
    expect(decryptSecret(b)).toBe("same-value");
  });

  it("throws on a tampered ciphertext (auth tag check)", () => {
    const encrypted = encryptSecret("value");
    const [iv, tag, ct] = encrypted.split(".");
    const tampered = [iv, tag, Buffer.from("tampered").toString("base64") + ct.slice(4)].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
