// IMPLEMENTED
// Server-side-only AI website generator (spec section 12). The API key lives
// only in this file's env var read — never sent to the client, never
// referenced from any "use client" component.
//
// Providers (auto-detected from the key, or forced with AI_PROVIDER):
//   - nvidia    key "nvapi-…"  -> NVIDIA NIM, OpenAI-compatible API (build.nvidia.com)
//   - anthropic key "sk-ant-…" -> Anthropic Messages API
// Override the model with AI_MODEL.

export type AiProvider = "anthropic" | "nvidia";

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-haiku-5-5",
  nvidia: "meta/llama-3.1-8b-instruct",
};

const REQUEST_TIMEOUT_MS = 55_000; // stay under the route's 60s maxDuration

export function cleanKey(raw: string | undefined): string | undefined {
  const k = raw?.trim().replace(/^["']|["']$/g, "").trim();
  return k || undefined;
}

export function resolveProvider(key: string | undefined, explicit?: string): AiProvider {
  const e = explicit?.trim().toLowerCase();
  if (e === "nvidia" || e === "anthropic") return e;
  return key?.startsWith("nvapi-") ? "nvidia" : "anthropic";
}

export class AiGenerationError extends Error {}

export type AiGenerateOptions = {
  prompt: string;
  style?: string;
  colorPreference?: string;
  websiteType?: string;
  darkMode?: boolean;
  animationLevel?: "none" | "subtle" | "playful";
};

export type AiGeneratedFiles = Record<string, string>;

function buildUserPrompt(opts: AiGenerateOptions): string {
  const parts = [opts.prompt];
  if (opts.websiteType) parts.push(`type:${opts.websiteType}`);
  if (opts.style) parts.push(`style:${opts.style}`);
  if (opts.colorPreference) parts.push(`colors:${opts.colorPreference}`);
  if (opts.darkMode === false) parts.push("light theme");
  if (opts.animationLevel && opts.animationLevel !== "subtle") parts.push(`animation:${opts.animationLevel}`);
  return parts.join(", ");
}

const SYSTEM_PROMPT = `Reply with ONLY a JSON object: {"index.html":"...","style.css":"..."}. Complete HTML document in index.html. CSS/JS injected externally — no <link>/<script> tags. Under 80 lines total. No text outside the JSON.`;

/** Parses the model's raw text output into a file map. Exported for testing. */
export function parseFilesFromResponse(text: string): AiGeneratedFiles {
  const cleaned = text.replace(/```json|```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Open models often wrap the JSON in a sentence of prose — fall back to
    // the outermost {...} span before giving up.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    try {
      if (start === -1 || end <= start) throw new Error("no object");
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      throw new AiGenerationError("The AI's response wasn't valid JSON.");
    }
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AiGenerationError("The AI's response wasn't a JSON object of files.");
  }
  const files: AiGeneratedFiles = {};
  for (const [path, content] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof content === "string") files[path] = content;
  }
  if (!files["index.html"]) {
    throw new AiGenerationError("The AI's response didn't include an index.html.");
  }
  return files;
}

type ModelOutput = { text: string; truncated: boolean };

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AiGenerationError(
        "The AI took too long to respond. Try a simpler description, or set AI_MODEL to a faster model."
      );
    }
    throw new AiGenerationError("Couldn't reach the AI provider. Try again in a moment.");
  } finally {
    clearTimeout(timer);
  }
}

async function failOnBadResponse(res: Response, provider: AiProvider, model: string): Promise<void> {
  if (res.status === 401 || res.status === 403) {
    throw new AiGenerationError(
      provider === "nvidia"
        ? `NVIDIA rejected the API key (${res.status}). Set AI_PROVIDER_API_KEY to a valid key (starts with nvapi-) from build.nvidia.com, then redeploy.`
        : `The AI provider rejected the API key (${res.status}). Set AI_PROVIDER_API_KEY to a valid Anthropic key (starts with sk-ant-) from console.anthropic.com, then redeploy.`
    );
  }
  if (res.status === 404) {
    throw new AiGenerationError(`The AI model "${model}" wasn't found. Check the AI_MODEL environment variable.`);
  }
  if (res.status === 429) {
    throw new AiGenerationError("The AI provider is rate limiting requests. Wait a minute and try again.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiGenerationError(`AI provider returned an error (${res.status}). ${body.slice(0, 200)}`);
  }
}

async function callAnthropic(key: string, model: string, system: string, user: string): Promise<ModelOutput> {
  const res = await timedFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1500, system, messages: [{ role: "user", content: user }] }),
  });
  await failOnBadResponse(res, "anthropic", model);
  const data = await res.json();
  const text: string = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  return { text, truncated: data.stop_reason === "max_tokens" };
}

async function callNvidia(key: string, model: string, system: string, user: string): Promise<ModelOutput> {
  const res = await timedFetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, Accept: "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 1500,
      temperature: 0.4,
      stream: false,
    }),
  });
  await failOnBadResponse(res, "nvidia", model);
  const data = await res.json();
  const choice = data.choices?.[0];
  return { text: choice?.message?.content ?? "", truncated: choice?.finish_reason === "length" };
}

export async function generateWebsiteFiles(opts: AiGenerateOptions): Promise<AiGeneratedFiles> {
  const key = cleanKey(process.env.AI_PROVIDER_API_KEY);
  if (!key) {
    throw new AiGenerationError("AI generation isn't configured — AI_PROVIDER_API_KEY is not set.");
  }
  const provider = resolveProvider(key, process.env.AI_PROVIDER);
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
  const user = buildUserPrompt(opts);

  const out =
    provider === "nvidia"
      ? await callNvidia(key, model, SYSTEM_PROMPT, user)
      : await callAnthropic(key, model, SYSTEM_PROMPT, user);

  try {
    return parseFilesFromResponse(out.text);
  } catch (err) {
    if (out.truncated) {
      throw new AiGenerationError(
        "The AI's response was cut off before it finished. Try a simpler description (fewer sections)."
      );
    }
    throw err;
  }
}
