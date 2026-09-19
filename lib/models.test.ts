import {
  CHAT_MODEL_OPTIONS,
  getChatModelOption,
  isChatModelId,
  DEFAULT_CHAT_MODEL_ID,
} from "@/lib/models";
import { getProviderAvailability, listModelsForClient, resolveChatLlm } from "@/lib/llm";
import { getOpenAIApiKey } from "@/lib/openai";

describe("chat model catalog", () => {
  it("includes auto plus major vendors", () => {
    const ids = CHAT_MODEL_OPTIONS.map((m) => m.id);
    expect(ids).toContain("auto");
    expect(ids.some((id) => id.startsWith("openai:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("anthropic:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("google:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("xai:"))).toBe(true);
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
    const llm = resolveChatLlm("auto");
    expect(llm.provider).toBe("openai");
    expect(llm.model).toBeTruthy();
  });

  it("rejects Claude when Anthropic key missing", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => resolveChatLlm("anthropic:claude-sonnet-4-5")).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("lists availability flags", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.XAI_API_KEY;
    const avail = getProviderAvailability();
    expect(avail.openai).toBe(true);
    expect(avail.xai).toBe(false);
    const listed = listModelsForClient();
    expect(listed.find((m) => m.id === "auto")?.available).toBe(true);
    expect(listed.find((m) => m.id === "xai:grok-3")?.available).toBe(false);
  });

  it("getOpenAIApiKey still works", () => {
    process.env.OPENAI_API_KEY = "sk-abc";
    expect(getOpenAIApiKey()).toBe("sk-abc");
  });
});
