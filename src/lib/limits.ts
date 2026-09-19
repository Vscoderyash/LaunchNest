// IMPLEMENTED
// Single source of truth for free-plan limits (spec section 20).
// Change values here only — nothing else should hardcode a limit.

export const PLAN_LIMITS = {
  FREE: {
    maxProjects: 3,
    maxStorageMb: 100,
    maxBandwidthMb: 1000,
    maxDeploymentsPerProject: 10,
  },
  // FUTURE: PRO and TEAM tiers — no billing integration yet (spec section 20/33).
  PRO: {
    maxProjects: 25,
    maxStorageMb: 5000,
    maxBandwidthMb: 50000,
    maxDeploymentsPerProject: 100,
  },
  TEAM: {
    maxProjects: 100,
    maxStorageMb: 20000,
    maxBandwidthMb: 200000,
    maxDeploymentsPerProject: 500,
  },
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;

export function getLimitsForTier(tier: PlanTier) {
  return PLAN_LIMITS[tier];
}

export const RESERVED_SLUGS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "dashboard",
  "auth",
  "login",
  "signup",
  "static",
  "assets",
  "cdn",
  "mail",
  "support",
  "docs",
  "status",
  "blog",
  "launchnest",
]);
