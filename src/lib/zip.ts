// IMPLEMENTED
// ZIP validation + extraction (spec section 10). Kept as pure functions so
// they're testable without spinning up a real HTTP request.

import AdmZip from "adm-zip";
import { isSafeProjectFilePath } from "./slug";

export const MAX_ZIP_BYTES = 20 * 1024 * 1024; // 20 MB raw upload
export const MAX_ENTRY_COUNT = 500;
export const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024; // zip-bomb guard

// Firestore caps a document at 1 MiB (1,048,576 bytes) TOTAL, including field
// overhead — not just this one field. Leave real headroom for the path/size/
// updatedAt fields and per-field overhead rather than cutting it close.
export const MAX_FIRESTORE_TEXT_BYTES = 900_000;

const TEXT_EXTENSIONS = new Set([
  "html", "htm", "css", "js", "mjs", "json", "svg", "txt", "md", "webmanifest",
]);

export type ExtractedFile = {
  path: string;
  content: string | null; // null for binary files not persisted in MVP local storage
  size: number;
  isText: boolean;
};

export type ExtractResult = {
  files: ExtractedFile[];
  framework: "STATIC" | "VITE_REACT" | "NEXTJS" | "UNKNOWN";
  warnings: string[];
};

export class ZipValidationError extends Error {}

function extOf(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * Validates and extracts a ZIP buffer into a flat file list.
 * Throws ZipValidationError with a user-facing message on any invalid input.
 */
export function extractZip(buffer: Buffer): ExtractResult {
  if (buffer.byteLength === 0) {
    throw new ZipValidationError("The uploaded file is empty.");
  }
  if (buffer.byteLength > MAX_ZIP_BYTES) {
    throw new ZipValidationError(
      `ZIP file is too large (max ${MAX_ZIP_BYTES / 1024 / 1024} MB).`
    );
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new ZipValidationError("This doesn't look like a valid ZIP file.");
  }

  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  if (entries.length === 0) {
    throw new ZipValidationError("The ZIP file has no files in it.");
  }
  if (entries.length > MAX_ENTRY_COUNT) {
    throw new ZipValidationError(
      `Too many files in ZIP (max ${MAX_ENTRY_COUNT}).`
    );
  }

  let totalUncompressed = 0;
  const files: ExtractedFile[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    // entryName can contain a single top-level folder (e.g. "my-site/index.html")
    // when the ZIP was made by dragging a folder in — strip one common root.
    const rawPath = entry.entryName.replace(/\\/g, "/");

    if (!isSafeProjectFilePath(rawPath)) {
      throw new ZipValidationError(`Unsafe file path in ZIP: "${rawPath}".`);
    }

    totalUncompressed += entry.header.size;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new ZipValidationError("ZIP contents are too large once extracted.");
    }

    const ext = extOf(rawPath);
    const isText = TEXT_EXTENSIONS.has(ext);

    if (isText && entry.header.size <= MAX_FIRESTORE_TEXT_BYTES) {
      files.push({
        path: rawPath,
        content: entry.getData().toString("utf-8"),
        size: entry.header.size,
        isText: true,
      });
    } else if (isText) {
      // Too large for a single Firestore document — demote to metadata-only,
      // same as a genuine binary file, rather than crash the whole upload
      // when Firestore rejects an oversized write.
      warnings.push(
        `"${rawPath}" is too large to store (${(entry.header.size / 1024).toFixed(0)} KB, max ~${MAX_FIRESTORE_TEXT_BYTES / 1024} KB per file) and was not saved — split it up or use object storage (see README).`
      );
      files.push({ path: rawPath, content: null, size: entry.header.size, isText: false });
    } else {
      // Binary assets (images, fonts, etc.): MOCKED — metadata is recorded but
      // bytes aren't persisted until S3-backed storage exists (see README).
      warnings.push(`"${rawPath}" is a binary asset and was not stored (needs S3 storage — see README).`);
      files.push({ path: rawPath, content: null, size: entry.header.size, isText: false });
    }
  }

  const paths = new Set(files.map((f) => f.path.split("/").pop()));
  // Strip a single common root folder if every file shares one, so
  // "my-site/index.html" becomes "index.html".
  const roots = new Set(files.map((f) => f.path.split("/")[0]));
  let normalized = files;
  if (roots.size === 1 && files.every((f) => f.path.includes("/"))) {
    normalized = files.map((f) => ({ ...f, path: f.path.split("/").slice(1).join("/") }));
  }

  const hasIndexHtml = normalized.some((f) => f.path === "index.html");
  const hasPackageJson = normalized.some((f) => f.path === "package.json");
  const hasViteConfig = normalized.some((f) => f.path.startsWith("vite.config."));
  const hasNextConfig = normalized.some((f) => f.path.startsWith("next.config."));

  if (!hasIndexHtml) {
    throw new ZipValidationError(
      "No index.html found at the root of the ZIP. Only static sites are supported in this MVP (see README)."
    );
  }

  let framework: ExtractResult["framework"] = "STATIC";
  if (hasNextConfig) framework = "NEXTJS";
  else if (hasViteConfig || hasPackageJson) framework = "VITE_REACT";

  if (framework !== "STATIC") {
    warnings.push(
      `Detected a ${framework} project alongside index.html — only the static files are deployed in this MVP; no build step runs (see README Build Order).`
    );
  }

  void paths; // kept for potential future duplicate-name diagnostics
  return { files: normalized, framework, warnings };
}
