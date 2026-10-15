// Pure logic for "which deployment is live right now".
// A temporary deployment (24h / 7d) takes over production while it's valid;
// once expired the site falls back to the most recent permanent READY
// deployment, and if there is none the site is inactive (spec section 16).

export type DeploymentLite = {
  id: string;
  version: number;
  status: string;
  isProduction: boolean;
  isTemporary: boolean;
  expiresAt: string | null;
};

export type ActiveDeployment<T> = {
  deployment: T | null;
  reason: "production" | "fallback" | "expired" | "none";
};

export function isExpired(d: Pick<DeploymentLite, "isTemporary" | "expiresAt">, now: Date): boolean {
  return d.isTemporary && d.expiresAt !== null && new Date(d.expiresAt).getTime() <= now.getTime();
}

export function pickActiveDeployment<T extends DeploymentLite>(deployments: T[], now: Date = new Date()): ActiveDeployment<T> {
  const sorted = [...deployments].sort((a, b) => b.version - a.version);
  const prod = sorted.find((d) => d.isProduction && d.status === "READY");
  if (!prod) return { deployment: null, reason: "none" };
  if (!isExpired(prod, now)) return { deployment: prod, reason: "production" };
  const fallback = sorted.find((d) => d.status === "READY" && !d.isTemporary);
  return fallback ? { deployment: fallback, reason: "fallback" } : { deployment: null, reason: "expired" };
}

export function expiryLabel(expiresAt: string | null, now: Date = new Date()): string {
  if (!expiresAt) return "";
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 48) return `expires in ${Math.floor(hours / 24)} days`;
  if (hours >= 1) return `expires in ${hours} hour${hours === 1 ? "" : "s"}`;
  return `expires in ${Math.max(1, Math.floor(ms / 60_000))} min`;
}
