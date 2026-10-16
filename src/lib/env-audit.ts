// Single source of truth for which environment variables this app reads, so
// "what should exist in Vercel" is answered by code, not memory. Used by
// /api/health to report booleans only — never values.

export const REQUIRED_ENV = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_SERVICE_ACCOUNT_KEY",
  "ENCRYPTION_KEY",
] as const;

/** Needed only for specific features. */
export const OPTIONAL_ENV = [
  "AI_PROVIDER_API_KEY", // AI website generation
  "AI_PROVIDER", // force "nvidia" | "anthropic"
  "AI_MODEL", // override the default model
  "BASE_DOMAIN", // wildcard-subdomain routing; leave unset until you own a domain with wildcard DNS
] as const;

/** Left over from the old Postgres/Auth.js/S3 versions — nothing reads these any more. */
export const UNUSED_ENV = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "GITHUB_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_SECRET",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_REGION",
  "FIREBASE_STORAGE_BUCKET_FOR_ASSETS",
] as const;

type Env = Record<string, string | undefined>;
const has = (env: Env, k: string) => Boolean(env[k] && env[k]!.trim().length > 0);

export function auditEnv(env: Env) {
  const aiKey = env.AI_PROVIDER_API_KEY?.trim().replace(/^["']|["']$/g, "") ?? "";
  return {
    missingRequired: REQUIRED_ENV.filter((k) => !has(env, k)),
    optionalSet: OPTIONAL_ENV.filter((k) => has(env, k)),
    // Present but dead: safe to delete from Vercel.
    deleteThese: UNUSED_ENV.filter((k) => env[k] !== undefined),
    // Format only — never the key itself.
    aiKey: !aiKey
      ? "not set"
      : aiKey.startsWith("nvapi-")
        ? "looks like an NVIDIA key"
        : aiKey.startsWith("sk-ant-")
          ? "looks like an Anthropic key"
          : "unrecognised format (expected nvapi-… or sk-ant-…)",
  };
}
