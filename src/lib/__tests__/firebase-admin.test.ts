import { describe, it, expect } from "vitest";
import { parseServiceAccountKey } from "@/lib/firebase-admin";

const VALID = {
  project_id: "launchnest-d9da3",
  client_email: "firebase-adminsdk@launchnest-d9da3.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nFAKEKEYDATA\n-----END PRIVATE KEY-----\n",
};

describe("parseServiceAccountKey", () => {
  it("parses a valid service account JSON", () => {
    const result = parseServiceAccountKey(JSON.stringify(VALID));
    expect(result.projectId).toBe(VALID.project_id);
    expect(result.clientEmail).toBe(VALID.client_email);
    expect(result.privateKey).toContain("BEGIN PRIVATE KEY");
  });

  it("throws a clear error when the env var is unset", () => {
    expect(() => parseServiceAccountKey(undefined)).toThrow(/not set/);
  });

  it("throws a clear error when the env var is an empty string", () => {
    expect(() => parseServiceAccountKey("")).toThrow(/not set/);
  });

  it("detects an unescaped quote-wrap (JSON.parse throws)", () => {
    // "{"project_id": ...}" with the inner quotes NOT escaped — JSON.parse
    // hits the first unescaped inner quote and fails.
    const wrapped = `"${JSON.stringify(VALID)}"`;
    expect(() => parseServiceAccountKey(wrapped)).toThrow(/extra pair of quotes/);
  });

  it("detects a fully-escaped quote-wrap (JSON.parse succeeds but yields a string, not an object)", () => {
    const doubleEncoded = JSON.stringify(JSON.stringify(VALID));
    expect(() => parseServiceAccountKey(doubleEncoded)).toThrow(/extra layer of quotes/);
  });

  it("rejects a JSON array (valid JSON, wrong shape)", () => {
    expect(() => parseServiceAccountKey("[1,2,3]")).toThrow(/isn't a JSON object/);
  });

  it("gives a generic but specific JSON error for other malformed input", () => {
    expect(() => parseServiceAccountKey("{not valid json")).toThrow(/not valid JSON/);
  });

  it("reports which required field is missing", () => {
    const missingKey = JSON.stringify({ project_id: "x", client_email: "y" });
    expect(() => parseServiceAccountKey(missingKey)).toThrow(/private_key/);
  });

  it("reports multiple missing fields together", () => {
    const missingBoth = JSON.stringify({ project_id: "x" });
    expect(() => parseServiceAccountKey(missingBoth)).toThrow(/client_email, private_key/);
  });
});
