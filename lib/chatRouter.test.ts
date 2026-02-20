import { suggestChatAgent, type ChatAgent } from "@/lib/chatRouter";

describe("chatRouter", () => {
  describe("suggestChatAgent", () => {
    it("suggests recruiting for hire/candidates message", () => {
      const r = suggestChatAgent("I need to hire 5 backend engineers in Toronto");
      expect(r.suggestedAgent).toBe("recruiting");
      expect(r.reason).toContain("recruit");
    });

    it("suggests recruiting for job posting and talent phrases", () => {
      expect(suggestChatAgent("We have a job opening for frontend")).toMatchObject({ suggestedAgent: "recruiting" });
      expect(suggestChatAgent("sourcing candidates in vancouver")).toMatchObject({ suggestedAgent: "recruiting" });
    });

    it("suggests onboarding for first day message", () => {
      const r = suggestChatAgent("What should I do on my first day? Who do I contact for IT access?");
      expect(r.suggestedAgent).toBe("onboarding");
      expect(r.reason).toContain("onboarding");
    });

    it("suggests onboarding for new hire and benefits phrases", () => {
      expect(suggestChatAgent("New hire orientation and handbook")).toMatchObject({ suggestedAgent: "onboarding" });
      expect(suggestChatAgent("benefits enrollment and direct deposit")).toMatchObject({ suggestedAgent: "onboarding" });
    });

    it("suggests compliance for policy/audit message", () => {
      const r = suggestChatAgent("What are the overtime rules in Ontario?");
      expect(r.suggestedAgent).toBe("compliance");
      expect(r.reason).toContain("Compliance");
    });

    it("returns compliance for empty message", () => {
      const r = suggestChatAgent("");
      expect(r.suggestedAgent).toBe("compliance");
      expect(r.reason).toBeDefined();
    });

    it("when both recruiting and onboarding phrases present, suggests onboarding", () => {
      const r = suggestChatAgent("We need to hire someone and get them through new hire onboarding");
      expect(r.suggestedAgent).toBe("onboarding");
      expect(r.reason).toContain("both");
    });

    it("trims whitespace and uses lower case for matching", () => {
      const r = suggestChatAgent("  FIRST DAY  ");
      expect(r.suggestedAgent).toBe("onboarding");
    });

    it("returns valid RouteSuggestion shape (suggestedAgent + reason)", () => {
      const agents: ChatAgent[] = ["recruiting", "compliance", "onboarding", "learning_development"];
      const r = suggestChatAgent("hire engineers");
      expect(agents).toContain(r.suggestedAgent);
      expect(typeof r.reason).toBe("string");
      expect(r.reason.length).toBeGreaterThan(0);
    });

    it("suggests learning_development for training and career development message", () => {
      const r = suggestChatAgent("What training do you recommend for leadership development?");
      expect(r.suggestedAgent).toBe("learning_development");
      expect(r.reason).toContain("learning");
    });

    it("suggests learning_development for skills and certification phrases", () => {
      expect(suggestChatAgent("I want to upskill and get a certification")).toMatchObject({ suggestedAgent: "learning_development" });
      expect(suggestChatAgent("career development and mentoring")).toMatchObject({ suggestedAgent: "learning_development" });
    });
  });
});
