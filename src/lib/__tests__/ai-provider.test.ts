import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { generateWebsiteFiles, AiGenerationError } from "@/lib/ai";

const OPTS = { prompt: "a portfolio" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  delete process.env.AI_PROVIDER;
  delete process.env.AI_MODEL;
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.AI_PROVIDER_API_KEY;
});

describe("NVIDIA provider request", () => {
  it("calls the NIM chat-completions endpoint with a Bearer key and parses the files", async () => {
    process.env.AI_PROVIDER_API_KEY = "nvapi-test";
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ choices: [{ message: { content: JSON.stringify({ "index.html": "<h1>ok</h1>" }) }, finish_reason: "stop" }] })
    );
    const files = await generateWebsiteFiles(OPTS);
    expect(files["index.html"]).toBe("<h1>ok</h1>");

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer nvapi-test");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("meta/llama-3.3-70b-instruct");
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
    expect(body.stream).toBe(false);
  });

  it("honours AI_MODEL", async () => {
    process.env.AI_PROVIDER_API_KEY = "nvapi-test";
    process.env.AI_MODEL = "meta/llama-3.1-8b-instruct";
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ choices: [{ message: { content: '{"index.html":"x"}' }, finish_reason: "stop" }] })
    );
    await generateWebsiteFiles(OPTS);
    expect(JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string).model).toBe("meta/llama-3.1-8b-instruct");
  });

  it("gives a clear message for a rejected key", async () => {
    process.env.AI_PROVIDER_API_KEY = "nvapi-bad";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ detail: "Unauthorized" }, 401));
    await expect(generateWebsiteFiles(OPTS)).rejects.toThrow(/nvapi-.*build\.nvidia\.com/);
  });

  it("reports a cut-off response instead of a confusing JSON error", async () => {
    process.env.AI_PROVIDER_API_KEY = "nvapi-test";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ choices: [{ message: { content: '{"index.html": "<h1>unfinished' }, finish_reason: "length" }] })
    );
    await expect(generateWebsiteFiles(OPTS)).rejects.toThrow(/cut off/);
  });

  it("explains a missing model", async () => {
    process.env.AI_PROVIDER_API_KEY = "nvapi-test";
    process.env.AI_MODEL = "nope/none";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({}, 404));
    await expect(generateWebsiteFiles(OPTS)).rejects.toThrow(/nope\/none.*AI_MODEL/);
  });
});

describe("Anthropic provider still works", () => {
  it("uses the Messages API for sk-ant keys", async () => {
    process.env.AI_PROVIDER_API_KEY = "sk-ant-test";
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ content: [{ type: "text", text: '{"index.html":"<p>a</p>"}' }], stop_reason: "end_turn" })
    );
    const files = await generateWebsiteFiles(OPTS);
    expect(files["index.html"]).toBe("<p>a</p>");
    expect((spy.mock.calls[0][0] as string)).toBe("https://api.anthropic.com/v1/messages");
  });
  it("fails clearly with no key", async () => {
    await expect(generateWebsiteFiles(OPTS)).rejects.toBeInstanceOf(AiGenerationError);
  });
});
