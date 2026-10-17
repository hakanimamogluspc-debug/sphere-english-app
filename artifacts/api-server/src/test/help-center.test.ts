import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, registerUser, createAdmin } from "./helpers.js";
import { seedHelpCenter, HELP_ARTICLES } from "../lib/help-center-seed.js";

beforeAll(async () => {
  await resetDb();
  await pool.query(`TRUNCATE help_article_feedback, help_search_log, help_articles, help_categories RESTART IDENTITY CASCADE`);
  await seedHelpCenter();
});
afterAll(closeDb);

describe("yardım merkezi — public", () => {
  it("kategoriler giriş olmadan listelenir, makale sayıları dolu", async () => {
    const res = await api().get("/api/help/categories");
    expect(res.status).toBe(200);
    expect(res.body.categories.length).toBeGreaterThan(5);
    const total = res.body.categories.reduce((s: number, c: any) => s + c.articleCount, 0);
    expect(total).toBe(HELP_ARTICLES.length);
  });

  it("tüm yayımlı makaleler listelenir; gövde (bodyMd) listede yok", async () => {
    const res = await api().get("/api/help/articles");
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(HELP_ARTICLES.length);
    expect(res.body.articles[0].bodyMd).toBeUndefined();
    expect(res.body.articles[0].categoryTitle).toBeTruthy();
  });

  it("arama: 'şifre' → şifre makalesi ilk sırada, arama loglanır", async () => {
    const res = await api().get("/api/help/articles?q=şifre");
    expect(res.status).toBe(200);
    expect(res.body.articles.length).toBeGreaterThan(0);
    expect(res.body.articles[0].slug).toBe("sifremi-unuttum");
    await new Promise((r) => setTimeout(r, 50));
    const { rows } = await pool.query(`SELECT query, result_count FROM help_search_log WHERE query = 'şifre'`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].result_count).toBeGreaterThan(0);
  });

  it("kategori filtresi yalnızca o kategoriyi döner", async () => {
    const res = await api().get("/api/help/articles?category=odeme");
    expect(res.status).toBe(200);
    expect(res.body.articles.every((a: any) => a.categorySlug === "odeme")).toBe(true);
  });

  it("makale detayı gövde + ilgili makaleler; görüntülenme artar", async () => {
    const a = await api().get("/api/help/articles/fatura-nasil-alirim");
    expect(a.status).toBe(200);
    expect(a.body.article.bodyMd).toContain("e-Fatura");
    expect(Array.isArray(a.body.related)).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    const { rows } = await pool.query(`SELECT view_count FROM help_articles WHERE slug = 'fatura-nasil-alirim'`);
    expect(rows[0].view_count).toBe(1);
  });

  it("olmayan / taslak makale → 404", async () => {
    expect((await api().get("/api/help/articles/yok-boyle-makale")).status).toBe(404);
    await pool.query(`UPDATE help_articles SET is_published = false WHERE slug = 'iade-ve-iptal'`);
    expect((await api().get("/api/help/articles/iade-ve-iptal")).status).toBe(404);
    const list = await api().get("/api/help/articles?category=odeme");
    expect(list.body.articles.some((x: any) => x.slug === "iade-ve-iptal")).toBe(false);
  });

  it("destek formu önerisi: 3 karakterden kısa → boş; 'kurum kodu' → kurumsal makale", async () => {
    expect((await api().get("/api/help/suggest?q=ku")).body.articles).toEqual([]);
    const res = await api().get("/api/help/suggest?q=kurum kodu");
    expect(res.body.articles.length).toBeGreaterThan(0);
    expect(res.body.articles.length).toBeLessThanOrEqual(5);
    expect(res.body.articles.map((a: any) => a.slug)).toContain("kurum-kodu-ve-calisan-ekleme");
  });

  it("faydalı oyu: anonim tek oy, değiştirince sayaç kayar; giriş yapmış kullanıcı ayrı sayılır", async () => {
    const slug = "sifremi-unuttum";
    const r1 = await api().post(`/api/help/articles/${slug}/feedback`).send({ helpful: true });
    expect(r1.status).toBe(200);
    expect(r1.body.helpfulYes).toBe(1);
    // aynı anonim tekrar evet → değişmez
    const r2 = await api().post(`/api/help/articles/${slug}/feedback`).send({ helpful: true });
    expect(r2.body.helpfulYes).toBe(1);
    // fikrini değiştirdi → evet 0, hayır 1
    const r3 = await api().post(`/api/help/articles/${slug}/feedback`).send({ helpful: false, comment: "Kurumsal e-posta kısmı eksik" });
    expect(r3.body.helpfulYes).toBe(0);
    expect(r3.body.helpfulNo).toBe(1);
    // giriş yapmış kullanıcı → ayrı oy
    const { token } = await registerUser();
    const r4 = await api().post(`/api/help/articles/${slug}/feedback`).set("Authorization", `Bearer ${token}`).send({ helpful: true });
    expect(r4.body.helpfulYes).toBe(1);
    expect(r4.body.helpfulNo).toBe(1);
    const bad = await api().post(`/api/help/articles/${slug}/feedback`).send({ helpful: "evet" });
    expect(bad.status).toBe(400);
  });
});

describe("yardım merkezi — admin", () => {
  it("öğrenci admin uçlarına giremez", async () => {
    const { token } = await registerUser();
    expect((await api().get("/api/admin/help/articles").set("Authorization", `Bearer ${token}`)).status).toBe(403);
    expect((await api().post("/api/admin/help/articles").set("Authorization", `Bearer ${token}`).send({ title: "x" })).status).toBe(403);
  });

  it("admin makale oluşturur (taslak → public'te görünmez), yayınlar, günceller, siler", async () => {
    const { token } = await createAdmin();
    const auth = { Authorization: `Bearer ${token}` };
    const { rows: cats } = await pool.query(`SELECT id FROM help_categories WHERE slug = 'hesap'`);

    const created = await api().post("/api/admin/help/articles").set(auth).send({
      title: "İki adımlı doğrulama nasıl açılır?", summary: "Test özeti", bodyMd: "## Adımlar\n\n1. Ayarlar\n2. Güvenlik", categoryId: cats[0].id, tags: ["2fa", "güvenlik"],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.article.slug).toBe("iki-adimli-dogrulama-nasil-acilir");
    expect((await api().get(`/api/help/articles/${created.body.article.slug}`)).status).toBe(404); // taslak

    const pub = await api().patch(`/api/admin/help/articles/${created.body.article.id}`).set(auth).send({ isPublished: true, summary: "Güncel özet" });
    expect(pub.status).toBe(200);
    const live = await api().get(`/api/help/articles/${created.body.article.slug}`);
    expect(live.status).toBe(200);
    expect(live.body.article.summary).toBe("Güncel özet");

    // aynı slug ile ikinci kayıt → 409
    const dup = await api().post("/api/admin/help/articles").set(auth).send({ title: "İki adımlı doğrulama nasıl açılır?" });
    expect(dup.status).toBe(409);

    const overview = await api().get("/api/admin/help/overview").set(auth);
    expect(overview.status).toBe(200);
    expect(overview.body.totals.articles).toBe(HELP_ARTICLES.length + 1);
    expect(overview.body.topSearches.some((s: any) => s.query === "şifre")).toBe(true);

    const del = await api().delete(`/api/admin/help/articles/${created.body.article.id}`).set(auth);
    expect(del.status).toBe(200);
    expect((await api().get(`/api/help/articles/${created.body.article.slug}`)).status).toBe(404);
  });

  it("içinde makale olan kategori silinemez", async () => {
    const { token } = await createAdmin();
    const { rows } = await pool.query(`SELECT id FROM help_categories WHERE slug = 'hesap'`);
    const res = await api().delete(`/api/admin/help/categories/${rows[0].id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
