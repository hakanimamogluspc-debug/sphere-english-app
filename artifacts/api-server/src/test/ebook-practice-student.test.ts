import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, registerUser } from "./helpers.js";
import { nextReview, buildQuiz, blankOut, usedTargets, BOX_INTERVAL_DAYS, type QuizSourceItem } from "../lib/ebook-practice-quiz.js";
import { setCoachForTests } from "../routes/my-ebook-practice.js";

describe("pratik yardımcıları", () => {
  it("Leitner: 'biliyorum' kutuyu artırır, 'tekrar' sıfırlar ve 10 dk sonraya koyar", () => {
    const now = new Date("2026-11-10T10:00:00Z");
    const a = nextReview(0, "know", now);
    expect(a.box).toBe(1);
    expect(a.dueAt.getTime() - now.getTime()).toBe(BOX_INTERVAL_DAYS[1] * 86400000);
    expect(nextReview(5, "know", now).box).toBe(5);
    const b = nextReview(4, "again", now);
    expect(b.box).toBe(0);
    expect(b.dueAt.getTime() - now.getTime()).toBe(10 * 60000);
  });

  it("boşluk doldurma ve mini test: doğru cevap şıklarda bir kez, şıklar tekrarsız", () => {
    expect(blankOut("Let's touch base tomorrow.", "Touch base")).toBe("Let's _____ tomorrow.");
    expect(blankOut("Nothing here", "agenda")).toBeNull();
    const items: QuizSourceItem[] = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1, kind: i % 2 ? "term" : "pattern", en: `phrase ${i}`, tr: `anlam ${i}`, exampleEn: `We said phrase ${i} today.`, unitOrder: 1,
    }));
    const qs = buildQuiz(items, items, 6, () => 0.42);
    expect(qs).toHaveLength(6);
    for (const q of qs) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.toLowerCase())).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
    }
    expect(qs.some((q) => q.type === "blank" && q.prompt.includes("_____"))).toBe(true);
  });

  it("koçta kullanılan hedef kalıplar yakalanır", () => {
    expect(usedTargets(["OK, let's touch base on Friday!"], ["Touch Base", "Circle back."])).toEqual(["Touch Base"]);
  });
});

let ebookId = 0;
let owner: { token: string; id: number };
let other: { token: string };
let itemIds: number[] = [];

beforeAll(async () => {
  await resetDb();
  ebookId = (await pool.query(
    `INSERT INTO ebooks (slug, title, description, author, price_try) VALUES ($1, 'Pratik Öğrenci', 'x', 'Sphere English', 399) RETURNING id`,
    [`pratik-ogr-${Date.now()}`],
  )).rows[0].id;
  const rows = [
    ["pattern", "Touch base", "kısa görüşmek", "Let's touch base tomorrow."],
    ["pattern", "Circle back", "konuya geri dönmek", "Let's circle back to it later."],
    ["term", "agenda", "gündem", null],
    ["term", "minutes", "tutanak", null],
    ["term", "action item", "yapılacak iş", null],
  ];
  for (let i = 0; i < rows.length; i++) {
    const [kind, en, tr, ex] = rows[i];
    itemIds.push((await pool.query(
      `INSERT INTO ebook_practice_items (ebook_id, unit_order, unit_title, position, kind, en, tr, example_en, status)
       VALUES ($1, 1, 'Ünite 1', $2, $3, $4, $5, $6, 'approved') RETURNING id`,
      [ebookId, i + 1, kind, en, tr, ex],
    )).rows[0].id);
  }
  await pool.query(
    `INSERT INTO ebook_practice_items (ebook_id, unit_order, unit_title, position, kind, en, tr, status)
     VALUES ($1, 1, 'Ünite 1', 99, 'term', 'draft only', 'taslak', 'draft')`, [ebookId],
  );
  const o = await registerUser();
  owner = { token: o.token!, id: o.user.id };
  other = { token: (await registerUser()).token! };
  await pool.query(
    `INSERT INTO ebook_purchases (ebook_id, user_id, buyer_email, amount_paid, download_token, download_count, download_expires_at, payment_status)
     VALUES ($1, $2, $3, 399, $4, 0, NOW() + INTERVAL '30 days', 'success')`,
    [ebookId, owner.id, o.email, `tok_pr_${Date.now()}_abcdefghijklmnop`],
  );
});
afterAll(async () => {
  setCoachForTests(null);
  await pool.query(`DELETE FROM ebooks WHERE id = $1`, [ebookId]).catch(() => {});
  await closeDb();
});

const as = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("öğrenci pratikleri", () => {
  it("yayında değilse 403, sahibi değilse 404", async () => {
    expect((await api().get(`/api/me/ebooks/${ebookId}/practice`).set(as(owner.token))).status).toBe(403);
    await pool.query(`UPDATE ebooks SET practice_published = TRUE WHERE id = $1`, [ebookId]);
    expect((await api().get(`/api/me/ebooks/${ebookId}/practice`).set(as(other.token))).status).toBe(404);
    const ok = await api().get(`/api/me/ebooks/${ebookId}/practice`).set(as(owner.token));
    expect(ok.status).toBe(200);
    expect(ok.body.units[0].total).toBe(5); // taslak öğe görünmez
    const lib = await api().get(`/api/me/ebooks`).set(as(owner.token));
    expect(lib.body.ebooks[0].practiceReady).toBe(true);
  });

  it("kartlar: yeni kartlar gelir; 'biliyorum' denen kart sırası gelene kadar çıkmaz", async () => {
    const c1 = (await api().get(`/api/me/ebooks/${ebookId}/practice/cards`).set(as(owner.token))).body.cards;
    expect(c1).toHaveLength(5);
    expect(c1.every((c: any) => c.isNew)).toBe(true);
    const r = await api().post(`/api/me/ebooks/practice/review`).set(as(owner.token)).send({ itemId: c1[0].id, result: "know" });
    expect(r.body.box).toBe(1);
    const c2 = (await api().get(`/api/me/ebooks/${ebookId}/practice/cards`).set(as(owner.token))).body.cards;
    expect(c2.map((c: any) => c.id)).not.toContain(c1[0].id);
    // Başkasının kitabındaki karta işaret koyamaz
    expect((await api().post(`/api/me/ebooks/practice/review`).set(as(other.token)).send({ itemId: c1[1].id, result: "know" })).status).toBe(404);
    expect((await api().post(`/api/me/ebooks/practice/review`).set(as(owner.token)).send({ itemId: c1[1].id, result: "belki" })).status).toBe(400);
  });

  it("mini test üretilir; sonuç kaydedilir, yanlışlar kart tekrarında öne alınır", async () => {
    const q = await api().get(`/api/me/ebooks/${ebookId}/practice/quiz?unit=1`).set(as(owner.token));
    expect(q.status).toBe(200);
    expect(q.body.questions.length).toBeGreaterThanOrEqual(3);
    const learnedId = itemIds[0]; // önceki testte "biliyorum" denmişti
    await api().post(`/api/me/ebooks/${ebookId}/practice/quiz-result`).set(as(owner.token))
      .send({ unitOrder: 1, correct: 4, total: 5, wrongItemIds: [learnedId] });
    const cards = (await api().get(`/api/me/ebooks/${ebookId}/practice/cards`).set(as(owner.token))).body.cards;
    expect(cards[0].id).toBe(learnedId);
    const sum = (await api().get(`/api/me/ebooks/${ebookId}/practice`).set(as(owner.token))).body.units[0];
    expect(sum.bestQuiz).toBe(80);
    expect((await api().post(`/api/me/ebooks/${ebookId}/practice/quiz-result`).set(as(owner.token)).send({ correct: 6, total: 5 })).status).toBe(400);
  });

  it("AI koç: ünitenin kalıplarını hedefler, kullanılanları işaretler, tur sınırı uygular", async () => {
    let lastSystem = "";
    setCoachForTests(async (system) => { lastSystem = system; return { reply: "Hi! Shall we start?", tip: null, scene: "Haftalık toplantıdasın." }; });
    const start = await api().post(`/api/me/ebooks/${ebookId}/practice/coach`).set(as(owner.token)).send({ unit: 1, messages: [] });
    expect(start.status).toBe(200);
    expect(start.body.scene).toBe("Haftalık toplantıdasın.");
    expect(start.body.targets).toEqual(["Touch base", "Circle back"]);
    expect(lastSystem).toContain("Touch base");

    const t2 = await api().post(`/api/me/ebooks/${ebookId}/practice/coach`).set(as(owner.token))
      .send({ unit: 1, messages: [{ role: "assistant", content: "Hi!" }, { role: "user", content: "Sure, let's touch base after lunch." }] });
    expect(t2.body.used).toEqual(["Touch base"]);

    const many = Array.from({ length: 9 }, () => [{ role: "assistant", content: "x" }, { role: "user", content: "y" }]).flat();
    expect((await api().post(`/api/me/ebooks/${ebookId}/practice/coach`).set(as(owner.token)).send({ unit: 1, messages: many })).status).toBe(400);
    expect((await api().post(`/api/me/ebooks/${ebookId}/practice/coach`).set(as(other.token)).send({ unit: 1, messages: [] })).status).toBe(404);
  });
});
