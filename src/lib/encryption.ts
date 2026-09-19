// IMPLEMENTED
// AES-256-GCM encrypt/decrypt for secrets at rest (spec section 18: env
// vars must be encrypted at rest and never re-sent to the client).
// ENCRYPTION_KEY must be a 32-byte value, base64 or utf-8 — validated below.

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32"
    );
  }
  // Accept either a base64-encoded 32-byte key or a raw 32-char string.
  const asBase64 = Buffer.from(raw, "base64");
  if (asBase64.length === 32) return asBase64;
  const asUtf8 = Buffer.from(raw, "utf-8");
  if (asUtf8.length === 32) return asUtf8;
  throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes.");
}

/** Returns a single string: base64(iv).base64(authTag).base64(ciphertext) */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptSecret(encoded: string): string {
  const key = getKey();
  const [ivB64, tagB64, ciphertextB64] = encoded.split(".");
  if (!ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted value.");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf-8");
}
