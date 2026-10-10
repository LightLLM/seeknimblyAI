import {
  applyProviderAllowlist,
  isProviderAllowed,
  parseAllowedProviders,
  getOrgAllowedProviders,
  setOrgAllowedProviders,
} from "@/lib/org-llm";
import { clearMemoryStore, insertRow } from "@/lib/store";

describe("org LLM allowlist", () => {
  const allOn = {
    openai: true,
    anthropic: true,
    google: true,
    xai: true,
    openrouter: true,
    ollama: true,
    huggingface: true,
  };

  beforeEach(() => {
    clearMemoryStore();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("parses null/empty as all allowed", () => {
    expect(parseAllowedProviders(null)).toBeNull();
    expect(parseAllowedProviders(undefined)).toBeNull();
    expect(parseAllowedProviders("")).toBeNull();
  });

  it("parses JSON array and filters unknown ids", () => {
    expect(parseAllowedProviders(["openrouter", "ollama", "nope"])).toEqual([
      "openrouter",
      "ollama",
    ]);
    expect(parseAllowedProviders('["openai"]')).toEqual(["openai"]);
  });

  it("masks availability for disallowed providers", () => {
    const masked = applyProviderAllowlist(allOn, ["openrouter", "ollama"]);
    expect(masked.openrouter).toBe(true);
    expect(masked.ollama).toBe(true);
    expect(masked.openai).toBe(false);
    expect(masked.anthropic).toBe(false);
  });

  it("treats null allowlist as no restriction", () => {
    expect(applyProviderAllowlist(allOn, null)).toEqual(allOn);
    expect(isProviderAllowed("openai", null)).toBe(true);
    expect(isProviderAllowed("openai", ["openrouter"])).toBe(false);
  });

  it("persists allowlist on org row", async () => {
    const org = await insertRow("orgs", { name: "Acme" });
    await setOrgAllowedProviders(String(org.id), ["openrouter"]);
    const allowed = await getOrgAllowedProviders(String(org.id));
    expect(allowed).toEqual(["openrouter"]);
  });
});
