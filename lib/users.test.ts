import {
  authenticatePasswordUser,
  createPasswordUser,
  ensureOAuthUser,
  findUserByEmail,
} from "@/lib/users";
import { clearMemoryStore } from "@/lib/store";

describe("app users", () => {
  beforeEach(() => {
    clearMemoryStore();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("creates and authenticates password users", async () => {
    const created = await createPasswordUser({
      email: "Founder@Acme.com",
      password: "securepass1",
      name: "Founder",
    });
    expect(created.email).toBe("founder@acme.com");
    expect(created.password_hash).toBeTruthy();

    const found = await findUserByEmail("founder@acme.com");
    expect(found?.id).toBe(created.id);

    const ok = await authenticatePasswordUser("founder@acme.com", "securepass1");
    expect(ok?.id).toBe(created.id);
    expect(await authenticatePasswordUser("founder@acme.com", "nope")).toBeNull();
  });

  it("rejects duplicate email signup", async () => {
    await createPasswordUser({ email: "a@b.com", password: "securepass1" });
    await expect(createPasswordUser({ email: "a@b.com", password: "securepass1" })).rejects.toThrow(
      /already exists/i
    );
  });

  it("upserts OAuth users and links providers", async () => {
    const u1 = await ensureOAuthUser({ email: "o@x.com", name: "O", provider: "google" });
    expect(u1.providers).toContain("google");
    const u2 = await ensureOAuthUser({ email: "o@x.com", provider: "azure-ad" });
    expect(u2.id).toBe(u1.id);
    expect(u2.providers).toEqual(expect.arrayContaining(["google", "azure-ad"]));
  });
});
