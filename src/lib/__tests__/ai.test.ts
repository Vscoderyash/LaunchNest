import { describe, it, expect } from "vitest";
import { parseFilesFromResponse, AiGenerationError, resolveProvider, cleanKey, DEFAULT_MODELS } from "@/lib/ai";

describe("parseFilesFromResponse", () => {
  it("parses a valid JSON file map", () => {
    const text = JSON.stringify({ "index.html": "<h1>hi</h1>", "style.css": "body{}" });
    const files = parseFilesFromResponse(text);
    expect(files["index.html"]).toBe("<h1>hi</h1>");
    expect(files["style.css"]).toBe("body{}");
  });

  it("strips markdown code fences the model might add anyway", () => {
    const text = "```json\n" + JSON.stringify({ "index.html": "<h1>hi</h1>" }) + "\n```";
    const files = parseFilesFromResponse(text);
    expect(files["index.html"]).toBe("<h1>hi</h1>");
  });

  it("throws when the response isn't valid JSON", () => {
    expect(() => parseFilesFromResponse("not json at all")).toThrow(AiGenerationError);
  });

  it("throws when index.html is missing", () => {
    const text = JSON.stringify({ "style.css": "body{}" });
    expect(() => parseFilesFromResponse(text)).toThrow(AiGenerationError);
  });

  it("throws when the response is a JSON array instead of an object", () => {
    expect(() => parseFilesFromResponse("[1,2,3]")).toThrow(AiGenerationError);
  });

  it("ignores non-string values in the object", () => {
    const text = JSON.stringify({ "index.html": "<h1>hi</h1>", extra: 123 });
    const files = parseFilesFromResponse(text);
    expect(files["index.html"]).toBe("<h1>hi</h1>");
    expect(files.extra).toBeUndefined();
  });
});

describe("parseFilesFromResponse with chatty models", () => {
  it("extracts the JSON object from surrounding prose", () => {
    const text = "Sure! Here is your site:\n" + JSON.stringify({ "index.html": "<h1>hi</h1>" }) + "\nHope that helps!";
    expect(parseFilesFromResponse(text)["index.html"]).toBe("<h1>hi</h1>");
  });
  it("still throws when there is no JSON object at all", () => {
    expect(() => parseFilesFromResponse("I cannot do that.")).toThrow(AiGenerationError);
  });
});

describe("resolveProvider / cleanKey", () => {
  it("detects NVIDIA from the nvapi- prefix", () => expect(resolveProvider("nvapi-abc")).toBe("nvidia"));
  it("defaults to NVIDIA always", () => {
    expect(resolveProvider("sk-ant-abc")).toBe("nvidia");
    expect(resolveProvider(undefined)).toBe("nvidia");
  });
  it("lets AI_PROVIDER=anthropic override to Anthropic", () => {
    expect(resolveProvider("sk-ant-abc", "anthropic")).toBe("anthropic");
    expect(resolveProvider("nvapi-abc", "bogus")).toBe("nvidia");
    expect(resolveProvider("nvapi-abc", "NVIDIA")).toBe("nvidia");
  });
  it("strips whitespace and wrapping quotes from keys", () => {
    expect(cleanKey('  "nvapi-abc" ')).toBe("nvapi-abc");
    expect(cleanKey("   ")).toBeUndefined();
    expect(cleanKey(undefined)).toBeUndefined();
  });
  it("has a default model for each provider", () => {
    expect(DEFAULT_MODELS.nvidia).toContain("/");
    expect(DEFAULT_MODELS.anthropic).toContain("claude");
  });
});
