import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { api, resetDb, closeDb, registerUser, uniqueEmail, VALID_PASSWORD, tokenFor } from "./helpers.js";

beforeAll(resetDb);
afterAll(closeDb);

describe("POST /api/auth/register", () => {
  it("sözleşme onayı olmadan kayıt reddedilir (KVKK)", async () => {
    const { res } = await registerUser({ termsAccepted: undefined });
    expect(res.status).toBe(400);
    expect(res.body.fields?.termsAccepted).toBeDefined();
  });

  it("termsAccepted=false da reddedilir", async () => {
    const { res } = await registerUser({ termsAccepted: false });
    expect(res.status).toBe(400);
  });

  it("zayıf parola reddedilir", async () => {
    const { res } = await registerUser({ password: "123" });
    expect(res.status).toBe(400);
    expect(res.body.fields?.password).toBeDefined();
  });

  it("geçerli bireysel kayıt → 201, token, öğrenci numarası, parola sızdırılmaz", async () => {
    const { res, email } = await registerUser();
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.email).toBe(email.toLowerCase());
    expect(res.body.user.role).toBe("student");
    expect(res.body.user.accountType).toBe("bireysel");
    expect(res.body.user.studentNumber).toMatch(/^SE-\d{4}-\d{4}$/);
    expect(res.body.user.termsVersion).toBeTruthy();
    expect(res.body.user.password).toBeUndefined();
    // httpOnly cookie de set edilir
    const cookie = (res.headers["set-cookie"] as unknown as string[] | undefined)?.join(";") ?? "";
    expect(cookie).toContain("sphere_token=");
    expect(cookie).toContain("HttpOnly");
  });

  it("e-posta büyük/küçük harf duyarsız; aynı e-posta ikinci kez kayıt olamaz", async () => {
    const email = uniqueEmail("dupe");
    const first = await registerUser({ email: email.toUpperCase() });
    expect(first.res.status).toBe(201);
    const second = await registerUser({ email });
    expect(second.res.status).toBe(400);
    expect(second.res.body.error).toMatch(/zaten/i);
  });

  it("kurumsal kayıt kurum kodu ister", async () => {
    const { res } = await registerUser({ accountType: "kurumsal", companyCode: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/kurum kodu/i);
  });

  it("geçersiz kurum kodu reddedilir", async () => {
    const { res } = await registerUser({ accountType: "kurumsal", companyCode: "YOK-BOYLE-KOD" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("yanlış parola → 401 (kullanıcı var mı yok mu belli edilmez)", async () => {
    const { email } = await registerUser();
    const res = await api().post("/api/auth/login").send({ email, password: "yanlis-parola-1" });
    expect(res.status).toBe(401);
    const res2 = await api().post("/api/auth/login").send({ email: uniqueEmail("ghost"), password: "x" });
    expect(res2.status).toBe(401);
    expect(res.body.error).toBe(res2.body.error);
  });

  it("doğru parola → token + kullanıcı; token /auth/me'de geçerli", async () => {
    const { email } = await registerUser();
    const res = await api().post("/api/auth/login").send({ email, password: VALID_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password).toBeUndefined();

    const me = await api().get("/api/auth/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(email.toLowerCase());
  });

  it("cookie ile de oturum açılır", async () => {
    const { email } = await registerUser();
    const login = await api().post("/api/auth/login").send({ email, password: VALID_PASSWORD });
    const cookie = login.headers["set-cookie"] as unknown as string[];
    const me = await api().get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
  });
});

describe("auth middleware", () => {
  it("token yoksa 401", async () => {
    const res = await api().get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("bozuk token → 401", async () => {
    const res = await api().get("/api/auth/me").set("Authorization", "Bearer bu.bir.token-degil");
    expect(res.status).toBe(401);
  });

  it("var olmayan kullanıcıya ait geçerli token → 401", async () => {
    const res = await api().get("/api/auth/me").set("Authorization", `Bearer ${tokenFor(999_999)}`);
    expect(res.status).toBe(401);
  });

  it("öğrenci admin endpoint'ine giremez", async () => {
    const { token } = await registerUser();
    const res = await api().get("/api/admin/monitoring/overview").set("Authorization", `Bearer ${token}`);
    expect([401, 403]).toContain(res.status);
  });
});
