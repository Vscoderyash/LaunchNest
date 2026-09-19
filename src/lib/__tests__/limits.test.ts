import { describe, it, expect } from "vitest";
import { getLimitsForTier, PLAN_LIMITS } from "@/lib/limits";

describe("getLimitsForTier", () => {
  it("returns the free plan project cap of 3 (spec section 20)", () => {
    expect(getLimitsForTier("FREE").maxProjects).toBe(3);
  });

  it("gives PRO a strictly higher project cap than FREE", () => {
    expect(getLimitsForTier("PRO").maxProjects).toBeGreaterThan(
      getLimitsForTier("FREE").maxProjects
    );
  });

  it("keeps all three tiers defined", () => {
    expect(Object.keys(PLAN_LIMITS).sort()).toEqual(["FREE", "PRO", "TEAM"]);
  });
});
