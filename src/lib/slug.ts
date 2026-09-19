// IMPLEMENTED
import { RESERVED_SLUGS } from "./limits";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 63 && SLUG_RE.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/** Prevents path traversal in uploaded/edited project file paths (spec section 21). */
export function isSafeProjectFilePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("..")) return false;
  if (path.includes("\0")) return false;
  // Only allow a conservative charset for file paths within a project.
  return /^[a-zA-Z0-9._/-]+$/.test(path);
}
