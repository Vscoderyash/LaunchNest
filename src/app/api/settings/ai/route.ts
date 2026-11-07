// Per-user AI key ("bring your own key"). Stored AES-256-GCM encrypted, never
// returned to the client — GET only reports whether one exists and its last 4 chars.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { aiSettingsCol } from "@/lib/firestore";
import { encryptSecret } from "@/lib/encryption";
import { cleanKey, isPlausibleAiKey, resolveProvider } from "@/lib/ai";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const snap = await aiSettingsCol().doc(session.uid).get();
  const serverKey = Boolean(cleanKey(process.env.AI_PROVIDER_API_KEY));
  if (snap.exists) {
    const d = snap.data()!;
    return NextResponse.json({ source: "user", provider: d.provider, last4: d.last4, serverKey });
  }
  return NextResponse.json({ source: serverKey ? "server" : "none", serverKey });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = z.object({ key: z.string().min(1).max(500) }).safeParse(body);
  const key = cleanKey(parsed.success ? parsed.data.key : undefined);
  if (!key || !isPlausibleAiKey(key)) {
    return NextResponse.json(
      { error: "That doesn't look like an AI key. NVIDIA keys start with nvapi-, Anthropic keys with sk-ant-." },
      { status: 400 }
    );
  }
  let encryptedKey: string;
  try {
    encryptedKey = encryptSecret(key);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Encryption failed." }, { status: 500 });
  }
  const provider = resolveProvider(key);
  await aiSettingsCol().doc(session.uid).set({ encryptedKey, provider, last4: key.slice(-4), updatedAt: new Date().toISOString() });
  return NextResponse.json({ source: "user", provider, last4: key.slice(-4) });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await aiSettingsCol().doc(session.uid).delete();
  return NextResponse.json({ success: true });
}
