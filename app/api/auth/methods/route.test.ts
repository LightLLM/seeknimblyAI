import { GET } from "@/app/api/auth/methods/route";

describe("GET /api/auth/methods", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("reports google/microsoft when env is set", async () => {
    process.env.GOOGLE_CLIENT_ID = "gid";
    process.env.GOOGLE_CLIENT_SECRET = "gsecret";
    process.env.AZURE_AD_CLIENT_ID = "aid";
    process.env.AZURE_AD_CLIENT_SECRET = "asecret";
    process.env.AZURE_AD_TENANT_ID = "common";
    delete process.env.RESEND_API_KEY;

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.google).toBe(true);
    expect(data.microsoft).toBe(true);
    expect(data.credentials).toBe(true);
    expect(data.magicLink).toBe(false);
  });

  it("hides oauth when unset", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.AZURE_AD_CLIENT_ID;
    delete process.env.AZURE_AD_CLIENT_SECRET;
    delete process.env.AZURE_AD_TENANT_ID;

    const res = await GET();
    const data = await res.json();
    expect(data.google).toBe(false);
    expect(data.microsoft).toBe(false);
  });
});
