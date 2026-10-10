import {
  CHAT_MODEL_OPTIONS,
  getChatModelOption,
  isChatModelId,
  DEFAULT_CHAT_MODEL_ID,
} from "@/lib/models";
import {
  getProviderAvailability,
  isLlmCreditOrQuotaError,
  listModelsForClient,
  resolveChatLlm,
  resolveQuotaFallbackLlm,
} from "@/lib/llm";
import { getOpenAIApiKey } from "@/lib/openai";

describe("chat model catalog", () => {
  it("includes auto plus major vendors", () => {
    const ids = CHAT_MODEL_OPTIONS.map((m) => m.id);
    expect(ids).toContain("auto");
    expect(ids.some((id) => id.startsWith("openai:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("anthropic:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("google:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("xai:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("openrouter:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("ollama:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("huggingface:"))).toBe(true);
  });

  it("validates ids and defaults unknown to auto", () => {
    expect(isChatModelId("auto")).toBe(true);
    expect(isChatModelId("nope")).toBe(false);
    expect(getChatModelOption("bogus").id).toBe(DEFAULT_CHAT_MODEL_ID);
  });
});

describe("resolveChatLlm", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("auto uses OpenAI when key present", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OLLAMA_ENABLED;
    delete process.env.HF_TOKEN;
    const llm = resolveChatLlm("auto");
    expect(llm.provider).toBe("openai");
    expect(llm.model).toBeTruthy();
  });

  it("rejects Claude when Anthropic key missing", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => resolveChatLlm("anthropic:claude-sonnet-4-5")).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("resolves OpenRouter and Ollama when enabled", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    const or = resolveChatLlm("openrouter:auto");
    expect(or.provider).toBe("openrouter");

    delete process.env.OPENROUTER_API_KEY;
    process.env.OLLAMA_ENABLED = "1";
    process.env.OLLAMA_MODEL = "llama3.2";
    const ol = resolveChatLlm("ollama:llama3.2");
    expect(ol.provider).toBe("ollama");
    expect(ol.model).toBe("llama3.2");
  });

  it("lists availability flags", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.XAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OLLAMA_ENABLED;
    const avail = getProviderAvailability();
    expect(avail.openai).toBe(true);
    expect(avail.xai).toBe(false);
    expect(avail.openrouter).toBe(false);
    const listed = listModelsForClient();
    expect(listed.find((m) => m.id === "auto")?.available).toBe(true);
    expect(listed.find((m) => m.id === "xai:grok-3")?.available).toBe(false);
  });

  it("getOpenAIApiKey still works", () => {
    process.env.OPENAI_API_KEY = "sk-abc";
    expect(getOpenAIApiKey()).toBe("sk-abc");
  });

  it("detects OpenAI out-of-credit / 429 quota errors", () => {
    expect(
      isLlmCreditOrQuotaError(
        Object.assign(new Error("429 You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/."), {
          status: 429,
          code: "insufficient_quota",
        })
      )
    ).toBe(true);
    expect(isLlmCreditOrQuotaError(new Error("network timeout"))).toBe(false);
  });

  it("falls back from OpenAI to OpenRouter on quota errors when key is set", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    const primary = resolveChatLlm("auto");
    expect(primary.provider).toBe("openai");
    const fb = resolveQuotaFallbackLlm(primary);
    expect(fb?.provider).toBe("openrouter");
  });

  it("org allowlist blocks OpenAI and prefers OpenRouter for Auto", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    delete process.env.ANTHROPIC_API_KEY;
    const llm = resolveChatLlm("auto", { allowedProviders: ["openrouter"] });
    expect(llm.provider).toBe("openrouter");
    expect(() => resolveChatLlm("openai:gpt-4o", { allowedProviders: ["openrouter"] })).toThrow(
      /blocked for this workspace/i
    );
    expect(resolveQuotaFallbackLlm(resolveChatLlm("openai:gpt-4o"), { allowedProviders: ["openrouter"] })?.provider).toBe(
      "openrouter"
    );
  });
});
