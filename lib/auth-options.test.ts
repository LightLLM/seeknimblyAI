import { buildAuthOptions, googleAuthConfigured, microsoftAuthConfigured } from "@/lib/auth-options";

describe("auth options", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("detects oauth env", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    expect(googleAuthConfigured()).toBe(false);
    process.env.GOOGLE_CLIENT_ID = "x";
    process.env.GOOGLE_CLIENT_SECRET = "y";
    expect(googleAuthConfigured()).toBe(true);

    delete process.env.AZURE_AD_CLIENT_ID;
    expect(microsoftAuthConfigured()).toBe(false);
    process.env.AZURE_AD_CLIENT_ID = "a";
    process.env.AZURE_AD_CLIENT_SECRET = "b";
    process.env.AZURE_AD_TENANT_ID = "common";
    expect(microsoftAuthConfigured()).toBe(true);
  });

  it("includes google and azure providers when configured", () => {
    process.env.NEXTAUTH_SECRET = "test-secret-at-least-32-chars-long!!";
    process.env.GOOGLE_CLIENT_ID = "gid";
    process.env.GOOGLE_CLIENT_SECRET = "gsecret";
    process.env.AZURE_AD_CLIENT_ID = "aid";
    process.env.AZURE_AD_CLIENT_SECRET = "asecret";
    process.env.AZURE_AD_TENANT_ID = "common";

    const opts = buildAuthOptions();
    const ids = opts.providers.map((p) => (p as { id?: string }).id ?? (p as { options?: { id?: string } }).options?.id);
    // next-auth providers expose .id
    const providerIds = opts.providers.map((p) => String((p as { id: string }).id));
    expect(providerIds).toContain("credentials");
    expect(providerIds).toContain("google");
    expect(providerIds).toContain("azure-ad");
    expect(ids.length).toBeGreaterThan(0);
  });
});
