import { describe, it, expect } from "vitest";
import {
  slugify,
  isValidSlug,
  isReservedSlug,
  isSafeProjectFilePath,
} from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("My Cool Project")).toBe("my-cool-project");
  });

  it("strips invalid characters", () => {
    expect(slugify("Portfolio!! 2024 :)")).toBe("portfolio-2024");
  });

  it("collapses repeated hyphens", () => {
    expect(slugify("a---b")).toBe("a-b");
  });
});

describe("isValidSlug", () => {
  it("rejects slugs shorter than 3 chars", () => {
    expect(isValidSlug("ab")).toBe(false);
  });

  it("rejects slugs with uppercase or symbols", () => {
    expect(isValidSlug("My_Site")).toBe(false);
  });

  it("accepts a well-formed slug", () => {
    expect(isValidSlug("my-site-2")).toBe(true);
  });
});

describe("isReservedSlug", () => {
  it("flags platform-reserved names", () => {
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("www")).toBe(true);
  });

  it("allows ordinary project names", () => {
    expect(isReservedSlug("my-portfolio")).toBe(false);
  });
});

describe("isSafeProjectFilePath", () => {
  it("rejects path traversal", () => {
    expect(isSafeProjectFilePath("../../etc/passwd")).toBe(false);
  });

  it("rejects absolute paths", () => {
    expect(isSafeProjectFilePath("/etc/passwd")).toBe(false);
  });

  it("accepts a normal relative file path", () => {
    expect(isSafeProjectFilePath("assets/logo.png")).toBe(true);
  });
});
