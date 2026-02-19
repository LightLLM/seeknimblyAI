import { chooseAgent } from "@/lib/agentRouter";

describe("agentRouter", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = origEnv;
  });

  describe("chooseAgent", () => {
    it("returns general_hr_assistant when no document", async () => {
      const result = await chooseAgent({
        message: "run a compliance check",
        history: [],
        hasDocument: false,
      });
      expect(result.agent).toBe("general_hr_assistant");
    });

    it("returns compliance_agent when document + compliance keyword", async () => {
      const result = await chooseAgent({
        message: "run a compliance check on this",
        history: [],
        hasDocument: true,
      });
      expect(result.agent).toBe("compliance_agent");
    });

    it("returns policy_doc_agent when document + handbook phrase", async () => {
      const result = await chooseAgent({
        message: "what does the handbook say about leave?",
        history: [],
        hasDocument: true,
      });
      expect(result.agent).toBe("policy_doc_agent");
    });

    it("returns risk_controls_agent when document + map to iso phrase", async () => {
      const result = await chooseAgent({
        message: "map this process to iso 9001 controls",
        history: [],
        hasDocument: true,
      });
      expect(result.agent).toBe("risk_controls_agent");
    });

    it("returns general_hr_assistant when document but no keyword (LLM path, no key)", async () => {
      const result = await chooseAgent({
        message: "what is the weather today?",
        history: [],
        hasDocument: true,
      });
      expect(result.agent).toBe("general_hr_assistant");
      expect(result.reason).toBe("no-api-key");
    });

    it("returns compliance_agent for audit keyword with document", async () => {
      const result = await chooseAgent({
        message: "I need an audit of our HR controls",
        history: [],
        hasDocument: true,
      });
      expect(result.agent).toBe("compliance_agent");
    });
  });
});
