import { describe, it, expect } from "vitest";
import { auditEnv, REQUIRED_ENV } from "@/lib/env-audit";

const full = Object.fromEntries(REQUIRED_ENV.map((k) => [k, "x"]));

describe("auditEnv", () => {
  it("reports nothing missing when all required vars are set", () => {
    expect(auditEnv(full).missingRequired).toEqual([]);
  });
  it("lists missing and blank required vars", () => {
    const r = auditEnv({ ...full, ENCRYPTION_KEY: "  ", FIREBASE_SERVICE_ACCOUNT_KEY: undefined });
    expect(r.missingRequired).toEqual(["FIREBASE_SERVICE_ACCOUNT_KEY", "ENCRYPTION_KEY"]);
  });
  it("flags dead leftovers to delete, even when empty", () => {
    const r = auditEnv({ ...full, DATABASE_URL: "", AUTH_SECRET: "x", S3_BUCKET: "b" });
    expect(r.deleteThese).toEqual(["DATABASE_URL", "AUTH_SECRET", "S3_BUCKET"]);
  });
  it("describes the AI key by format only", () => {
    expect(auditEnv({ AI_PROVIDER_API_KEY: "nvapi-abc" }).aiKey).toMatch(/NVIDIA/);
    expect(auditEnv({ AI_PROVIDER_API_KEY: '"sk-ant-abc"' }).aiKey).toMatch(/Anthropic/);
    expect(auditEnv({ AI_PROVIDER_API_KEY: "sk-proj-abc" }).aiKey).toMatch(/unrecognised/);
    expect(auditEnv({}).aiKey).toBe("not set");
    expect(JSON.stringify(auditEnv({ AI_PROVIDER_API_KEY: "nvapi-SECRET123" }))).not.toContain("SECRET123");
  });
});
