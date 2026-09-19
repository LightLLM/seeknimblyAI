/**
 * Resolve a chat model choice to an OpenAI-compatible client + model id.
 * OpenAI / xAI / Gemini use the OpenAI SDK; Claude uses a thin Messages bridge
 * that exposes the same chat.completions.create(stream) surface the runtime needs.
 */

import OpenAI from "openai";
import { getOpenAIApiKey, getOpenAIAgentModel } from "@/lib/openai";
import {
  CHAT_MODEL_OPTIONS,
  getChatModelOption,
  type ChatModelOption,
  type ModelProvider,
} from "@/lib/models";

export type ResolvedLlm = {
  client: OpenAI;
  model: string;
  option: ChatModelOption;
  provider: ModelProvider;
};

export type ProviderAvailability = Record<ModelProvider, boolean>;

export function getProviderAvailability(): ProviderAvailability {
  return {
    openai: Boolean(getOpenAIApiKey()),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    google: Boolean(process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim()),
    xai: Boolean(process.env.XAI_API_KEY?.trim()),
  };
}

function googleKey(): string | null {
  const k = (process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? "").trim();
  return k || null;
}

function anthropicKey(): string | null {
  const k = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  return k || null;
}

function xaiKey(): string | null {
  const k = (process.env.XAI_API_KEY ?? "").trim();
  return k || null;
}

function pickAuto(avail: ProviderAvailability): { provider: ModelProvider; apiModel: string; label: string } {
  if (avail.openai) {
    return { provider: "openai", apiModel: getOpenAIAgentModel("gpt-4o"), label: "Auto (ChatGPT)" };
  }
  if (avail.anthropic) {
    return { provider: "anthropic", apiModel: "claude-sonnet-4-5", label: "Auto (Claude)" };
  }
  if (avail.google) {
    return { provider: "google", apiModel: "gemini-2.5-flash", label: "Auto (Gemini)" };
  }
  if (avail.xai) {
    return { provider: "xai", apiModel: "grok-3", label: "Auto (Grok)" };
  }
  throw new Error(
    "No LLM API key configured. Set OPENAI_API_KEY (or ANTHROPIC_API_KEY / GOOGLE_API_KEY / XAI_API_KEY)."
  );
}

/** OpenAI-compatible client for OpenAI, Gemini, and xAI. */
function openAiCompatClient(provider: ModelProvider): OpenAI {
  if (provider === "openai") {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
    return new OpenAI({ apiKey });
  }
  if (provider === "xai") {
    const apiKey = xaiKey();
    if (!apiKey) throw new Error("XAI_API_KEY is not configured for Grok.");
    return new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
  }
  if (provider === "google") {
    const apiKey = googleKey();
    if (!apiKey) throw new Error("GOOGLE_API_KEY (or GEMINI_API_KEY) is not configured for Gemini.");
    return new OpenAI({
      apiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
  }
  throw new Error(`openAiCompatClient does not support ${provider}`);
}

type OaiMsg = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type OaiTool = OpenAI.Chat.Completions.ChatCompletionTool;

function toAnthropicMessages(messages: OaiMsg[]): {
  system: string;
  messages: Array<Record<string, unknown>>;
} {
  let system = "";
  const out: Array<Record<string, unknown>> = [];

  for (const m of messages) {
    if (m.role === "system") {
      system += (typeof m.content === "string" ? m.content : "") + "\n";
      continue;
    }
    if (m.role === "user") {
      out.push({ role: "user", content: typeof m.content === "string" ? m.content : "" });
      continue;
    }
    if (m.role === "assistant") {
      const toolCalls = "tool_calls" in m && Array.isArray(m.tool_calls) ? m.tool_calls : null;
      if (toolCalls && toolCalls.length > 0) {
        const content: Array<Record<string, unknown>> = [];
        if (typeof m.content === "string" && m.content) {
          content.push({ type: "text", text: m.content });
        }
        for (const tc of toolCalls) {
          if (tc.type !== "function") continue;
          let input: unknown = {};
          try {
            input = JSON.parse(tc.function.arguments || "{}");
          } catch {
            input = {};
          }
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input,
          });
        }
        out.push({ role: "assistant", content });
      } else {
        out.push({ role: "assistant", content: typeof m.content === "string" ? m.content : "" });
      }
      continue;
    }
    if (m.role === "tool") {
      const toolCallId = "tool_call_id" in m ? String(m.tool_call_id) : "";
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
      // Anthropic expects tool results as user turns
      const last = out[out.length - 1];
      const block = {
        type: "tool_result",
        tool_use_id: toolCallId,
        content,
      };
      if (last && last.role === "user" && Array.isArray(last.content)) {
        (last.content as unknown[]).push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
    }
  }

  return { system: system.trim(), messages: out };
}

function anthropicTools(tools: OaiTool[] | undefined) {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? "",
    input_schema: t.function.parameters ?? { type: "object", properties: {} },
  }));
}

/** Minimal OpenAI-shaped client backed by Anthropic Messages streaming. */
function anthropicCompatClient(apiKey: string): OpenAI {
  const create = async (params: {
    model: string;
    messages: OaiMsg[];
    tools?: OaiTool[];
    max_completion_tokens?: number;
    stream?: boolean;
  }) => {
    const { system, messages } = toAnthropicMessages(params.messages);
    const body = {
      model: params.model,
      max_tokens: params.max_completion_tokens ?? 1536,
      system: system || undefined,
      messages,
      tools: anthropicTools(params.tools),
      stream: true,
    };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Anthropic error ${res.status}: ${errText.slice(0, 400)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let toolIndex = -1;
    const toolIndexes = new Map<string, number>();

    async function* iterate() {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const line of parts) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            continue;
          }
          const type = String(ev.type ?? "");
          if (type === "content_block_delta") {
            const delta = ev.delta as Record<string, unknown> | undefined;
            if (delta?.type === "text_delta" && typeof delta.text === "string") {
              yield {
                choices: [{ delta: { content: delta.text } }],
              };
            } else if (delta?.type === "input_json_delta" && typeof delta.partial_json === "string") {
              const idx = toolIndex >= 0 ? toolIndex : 0;
              yield {
                choices: [
                  {
                    delta: {
                      tool_calls: [{ index: idx, function: { arguments: delta.partial_json } }],
                    },
                  },
                ],
              };
            }
          } else if (type === "content_block_start") {
            const block = ev.content_block as Record<string, unknown> | undefined;
            if (block?.type === "tool_use") {
              toolIndex += 1;
              const id = String(block.id ?? `tool_${toolIndex}`);
              toolIndexes.set(id, toolIndex);
              yield {
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        {
                          index: toolIndex,
                          id,
                          type: "function",
                          function: { name: String(block.name ?? ""), arguments: "" },
                        },
                      ],
                    },
                  },
                ],
              };
            }
          }
        }
      }
    }

    return iterate();
  };

  // Duck-type as OpenAI for our runtime
  return {
    chat: {
      completions: {
        create,
      },
    },
  } as unknown as OpenAI;
}

/**
 * Resolve user model choice to a runnable client. Throws a user-facing Error
 * if the chosen provider has no API key.
 */
export function resolveChatLlm(modelId: string | null | undefined): ResolvedLlm {
  const option = getChatModelOption(modelId);
  const avail = getProviderAvailability();

  if (option.id === "auto") {
    const picked = pickAuto(avail);
    if (picked.provider === "anthropic") {
      return {
        client: anthropicCompatClient(anthropicKey()!),
        model: picked.apiModel,
        option: { ...option, label: picked.label },
        provider: "anthropic",
      };
    }
    return {
      client: openAiCompatClient(picked.provider),
      model: picked.apiModel,
      option: { ...option, label: picked.label },
      provider: picked.provider,
    };
  }

  const provider = option.provider as ModelProvider;
  if (!avail[provider]) {
    const envHint =
      provider === "openai"
        ? "OPENAI_API_KEY"
        : provider === "anthropic"
          ? "ANTHROPIC_API_KEY"
          : provider === "google"
            ? "GOOGLE_API_KEY"
            : "XAI_API_KEY";
    throw new Error(`${option.label} is not available (set ${envHint}), or pick Auto / another model.`);
  }

  if (provider === "anthropic") {
    return {
      client: anthropicCompatClient(anthropicKey()!),
      model: option.apiModel,
      option,
      provider,
    };
  }

  return {
    client: openAiCompatClient(provider),
    model: option.apiModel,
    option,
    provider,
  };
}

export function listModelsForClient() {
  const avail = getProviderAvailability();
  return CHAT_MODEL_OPTIONS.map((m) => ({
    ...m,
    available: m.id === "auto" ? Object.values(avail).some(Boolean) : avail[m.provider as ModelProvider],
  }));
}
