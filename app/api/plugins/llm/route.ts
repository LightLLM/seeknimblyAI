/** GET /api/plugins/llm — which LLM providers are wired (no secrets). */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getProviderAvailability, listModelsForClient } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  const token = secret ? await getToken({ req, secret }) : null;
  if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const avail = getProviderAvailability();
  return NextResponse.json({
    providers: [
      {
        id: "openrouter",
        label: "OpenRouter",
        available: avail.openrouter,
        env: "OPENROUTER_API_KEY",
        hint: "One key → many models (Llama, Claude, Gemini, etc.). https://openrouter.ai/keys",
      },
      {
        id: "ollama",
        label: "Ollama (local)",
        available: avail.ollama,
        env: "OLLAMA_ENABLED=1 · OLLAMA_BASE_URL · OLLAMA_MODEL",
        hint: "Run Ollama on this machine (or a reachable host). Default http://127.0.0.1:11434 — not available on Vercel serverless.",
      },
      {
        id: "huggingface",
        label: "Hugging Face",
        available: avail.huggingface,
        env: "HF_TOKEN",
        hint: "OpenAI-compatible router: https://router.huggingface.co/v1 — set HF_MODEL to override.",
      },
      {
        id: "openai",
        label: "OpenAI / ChatGPT",
        available: avail.openai,
        env: "OPENAI_API_KEY",
        hint: "Default cloud path for agent tool loops.",
      },
    ],
    models: listModelsForClient().filter((m) =>
      ["openrouter", "ollama", "huggingface", "auto"].includes(String(m.provider))
    ),
  });
}
