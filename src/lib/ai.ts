// IMPLEMENTED
// Server-side-only AI website generator (spec section 12). The API key
// lives only in this file's env var read — never sent to the client, never
// referenced from any "use client" component.

const AI_API_KEY = process.env.AI_PROVIDER_API_KEY;
const AI_MODEL = process.env.AI_MODEL || "claude-sonnet-4-6";

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
  const parts = [`Build a website: ${opts.prompt}`];
  if (opts.websiteType) parts.push(`Website type: ${opts.websiteType}.`);
  if (opts.style) parts.push(`Visual style: ${opts.style}.`);
  if (opts.colorPreference) parts.push(`Color preference: ${opts.colorPreference}.`);
  parts.push(`Theme: ${opts.darkMode === false ? "light" : "dark"} mode.`);
  parts.push(`Animation level: ${opts.animationLevel ?? "subtle"}.`);
  parts.push("The site must be responsive on mobile.");
  return parts.join(" ");
}

const SYSTEM_PROMPT = `You generate simple static websites (HTML/CSS/vanilla JS only — no build step, no frameworks).

Respond with ONLY a single JSON object, no markdown fences, no explanation before or after. The object's keys are file paths and values are the complete file contents as strings. You must include "index.html" as a key. You may also include "style.css" and "script.js" if useful — index.html should link/reference them by those exact relative paths.

Keep every file's content well under 100 KB. Do not include any commentary, only the JSON object.`;

/** Parses the model's raw text output into a file map. Exported for testing. */
export function parseFilesFromResponse(text: string): AiGeneratedFiles {
  const cleaned = text.replace(/```json|```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AiGenerationError("The AI's response wasn't valid JSON.");
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

export async function generateWebsiteFiles(opts: AiGenerateOptions): Promise<AiGeneratedFiles> {
  if (!AI_API_KEY) {
    throw new AiGenerationError(
      "AI generation isn't configured — AI_PROVIDER_API_KEY is not set."
    );
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": AI_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(opts) }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiGenerationError(`AI provider returned an error (${res.status}). ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");

  return parseFilesFromResponse(text);
}
