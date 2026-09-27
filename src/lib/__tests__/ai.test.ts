import { describe, it, expect } from "vitest";
import { parseFilesFromResponse, AiGenerationError } from "@/lib/ai";

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
