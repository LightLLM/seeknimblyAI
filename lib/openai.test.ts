import { getOpenAIApiKey, getOpenAIModel } from "@/lib/openai";

describe("openai", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  describe("getOpenAIApiKey", () => {
    it("returns null when OPENAI_API_KEY is missing", () => {
      delete process.env.OPENAI_API_KEY;
      expect(getOpenAIApiKey()).toBe(null);
    });

    it("returns null when OPENAI_API_KEY is empty after trim", () => {
      process.env.OPENAI_API_KEY = "   ";
      expect(getOpenAIApiKey()).toBe(null);
    });

    it("returns key when set", () => {
      process.env.OPENAI_API_KEY = "sk-test123";
      expect(getOpenAIApiKey()).toBe("sk-test123");
    });

    it("strips Bearer prefix", () => {
      process.env.OPENAI_API_KEY = "Bearer sk-test456";
      expect(getOpenAIApiKey()).toBe("sk-test456");
    });

    it("strips control characters and newlines", () => {
      process.env.OPENAI_API_KEY = "sk-test\n\r\x00abc";
      expect(getOpenAIApiKey()).toBe("sk-testabc");
    });
  });

  describe("getOpenAIModel", () => {
    it("returns default when OPENAI_MODEL is missing", () => {
      delete process.env.OPENAI_MODEL;
      expect(getOpenAIModel("gpt-4o")).toBe("gpt-4o");
    });

    it("returns env value when set", () => {
      process.env.OPENAI_MODEL = "gpt-4o-mini";
      expect(getOpenAIModel("gpt-4o")).toBe("gpt-4o-mini");
    });

    it("returns default when OPENAI_MODEL is empty after sanitize", () => {
      process.env.OPENAI_MODEL = "  \n  ";
      expect(getOpenAIModel("gpt-4o")).toBe("gpt-4o");
    });
  });
});
