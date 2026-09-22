import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";
import { extractZip, ZipValidationError, MAX_FIRESTORE_TEXT_BYTES } from "@/lib/zip";

function buildZip(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [path, content] of Object.entries(files)) {
    zip.addFile(path, Buffer.from(content, "utf-8"));
  }
  return zip.toBuffer();
}

describe("extractZip", () => {
  it("extracts a valid static site", () => {
    const buf = buildZip({
      "index.html": "<h1>hi</h1>",
      "style.css": "body{color:red}",
    });
    const result = extractZip(buf);
    expect(result.framework).toBe("STATIC");
    expect(result.files.map((f) => f.path).sort()).toEqual(["index.html", "style.css"]);
    expect(result.files.find((f) => f.path === "index.html")?.content).toContain("<h1>hi</h1>");
  });

  it("strips a single common root folder", () => {
    const buf = buildZip({
      "my-site/index.html": "<h1>hi</h1>",
      "my-site/style.css": "body{color:red}",
    });
    const result = extractZip(buf);
    expect(result.files.map((f) => f.path).sort()).toEqual(["index.html", "style.css"]);
  });

  it("rejects a ZIP with no index.html", () => {
    const buf = buildZip({ "style.css": "body{color:red}" });
    expect(() => extractZip(buf)).toThrow(ZipValidationError);
  });

  it("normalizes traversal-looking paths (adm-zip strips leading ../ on write; isSafeProjectFilePath is the real guard, tested separately in slug.test.ts)", () => {
    const buf = buildZip({
      "index.html": "<h1>hi</h1>",
      "../../etc/passwd": "root:x:0:0",
    });
    const result = extractZip(buf);
    // adm-zip already normalized this to "etc/passwd" on write — confirms
    // defense in depth even before isSafeProjectFilePath runs.
    expect(result.files.some((f) => f.path.includes(".."))).toBe(false);
  });

  it("rejects an empty buffer", () => {
    expect(() => extractZip(Buffer.alloc(0))).toThrow(ZipValidationError);
  });

  it("marks non-text files as binary and warns instead of storing content", () => {
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from("<h1>hi</h1>"));
    zip.addFile("logo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const result = extractZip(zip.toBuffer());
    const logo = result.files.find((f) => f.path === "logo.png");
    expect(logo?.isText).toBe(false);
    expect(logo?.content).toBeNull();
    expect(result.warnings.some((w) => w.includes("logo.png"))).toBe(true);
  });

  it("flags a detected framework alongside index.html without failing", () => {
    const buf = buildZip({
      "index.html": "<h1>hi</h1>",
      "package.json": "{}",
      "vite.config.js": "export default {}",
    });
    const result = extractZip(buf);
    expect(result.framework).toBe("VITE_REACT");
    expect(result.warnings.some((w) => w.includes("VITE_REACT"))).toBe(true);
  });

  it("demotes an oversized text file to metadata-only instead of crashing", () => {
    const bigContent = "a".repeat(MAX_FIRESTORE_TEXT_BYTES + 1000);
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from("<h1>hi</h1>"));
    zip.addFile("bundle.js", Buffer.from(bigContent));
    const result = extractZip(zip.toBuffer());
    const bundle = result.files.find((f) => f.path === "bundle.js");
    expect(bundle?.isText).toBe(false);
    expect(bundle?.content).toBeNull();
    expect(bundle?.size).toBeGreaterThan(MAX_FIRESTORE_TEXT_BYTES);
    expect(result.warnings.some((w) => w.includes("bundle.js") && w.includes("too large"))).toBe(true);
  });
});
