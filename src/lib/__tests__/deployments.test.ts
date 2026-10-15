import { describe, it, expect } from "vitest";
import { pickActiveDeployment, isExpired, expiryLabel, type DeploymentLite } from "@/lib/deployments";

const now = new Date("2026-10-15T12:00:00Z");
const d = (o: Partial<DeploymentLite> & { version: number }): DeploymentLite => ({
  id: `d${o.version}`, status: "READY", isProduction: false, isTemporary: false, expiresAt: null, ...o,
});

describe("pickActiveDeployment", () => {
  it("serves the production READY deployment", () => {
    const r = pickActiveDeployment([d({ version: 1 }), d({ version: 2, isProduction: true })], now);
    expect(r.reason).toBe("production");
    expect(r.deployment?.id).toBe("d2");
  });
  it("is inactive when nothing is in production", () => {
    expect(pickActiveDeployment([d({ version: 1 })], now).reason).toBe("none");
  });
  it("ignores a production deployment that isn't READY", () => {
    expect(pickActiveDeployment([d({ version: 1, isProduction: true, status: "FAILED" })], now).reason).toBe("none");
  });
  it("serves a temporary deployment until it expires", () => {
    const tmp = d({ version: 2, isProduction: true, isTemporary: true, expiresAt: "2026-10-15T18:00:00Z" });
    expect(pickActiveDeployment([d({ version: 1 }), tmp], now).deployment?.id).toBe("d2");
  });
  it("falls back to the latest permanent deployment after a temporary one expires", () => {
    const tmp = d({ version: 3, isProduction: true, isTemporary: true, expiresAt: "2026-10-15T06:00:00Z" });
    const r = pickActiveDeployment([d({ version: 1 }), d({ version: 2 }), tmp], now);
    expect(r.reason).toBe("fallback");
    expect(r.deployment?.id).toBe("d2");
  });
  it("is expired (inactive) when an expired temporary deployment has nothing to fall back to", () => {
    const tmp = d({ version: 1, isProduction: true, isTemporary: true, expiresAt: "2026-10-15T06:00:00Z" });
    expect(pickActiveDeployment([tmp], now).reason).toBe("expired");
  });
});

describe("isExpired / expiryLabel", () => {
  it("only temporary deployments expire", () => {
    expect(isExpired({ isTemporary: false, expiresAt: "2020-01-01T00:00:00Z" }, now)).toBe(false);
  });
  it("labels remaining time", () => {
    expect(expiryLabel("2026-10-15T17:00:00Z", now)).toBe("expires in 5 hours");
    expect(expiryLabel("2026-10-15T12:30:00Z", now)).toBe("expires in 30 min");
    expect(expiryLabel("2026-10-20T12:00:00Z", now)).toBe("expires in 5 days");
    expect(expiryLabel("2026-10-15T11:00:00Z", now)).toBe("expired");
  });
});
