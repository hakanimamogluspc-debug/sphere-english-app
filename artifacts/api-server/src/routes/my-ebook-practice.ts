/**
 * Kitaplarım → kitaba özel pratikler (yalnızca kitabın sahibi + kitap pratiğe yayındaysa + onaylı öğeler).
 *
 *   GET  /me/ebooks/:id/practice                 → üniteler + ilerleme özeti
 *   GET  /me/ebooks/:id/practice/cards?unit=N    → sırası gelen kartlar, sonra yeni kartlar (en fazla 20)
 *   POST /me/ebooks/practice/review              { itemId, result: "know" | "again" }
 *   GET  /me/ebooks/:id/practice/quiz?unit=N     → 10 soruluk mini test
 *   POST /me/ebooks/:id/practice/quiz-result     { unitOrder, correct, total, wrongItemIds }
 *   POST /me/ebooks/:id/practice/coach           { unit, messages } → AI koçla rol yapma
 */

import { Router, type Response } from "express";
import OpenAI from "openai";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth.js";
import { openaiTrackedFetch } from "../lib/ai-usage.js";
import { nextReview, buildQuiz, usedTargets, LEARNED_BOX, type QuizSourceItem } from "../lib/ebook-practice-quiz.js";

const router = Router();

/** Kitabın sahibi mi ve kitap pratiğe açık mı? Değilse yanıtı yazar, false döner. */
async function guard(req: AuthRequest, res: Response): Promise<number | null> {
  const ebookId = Number(req.params.id);
  if (!Number.isInteger(ebookId)) { res.status(400).json({ error: "Geçersiz kitap" }); return null; }
  const r = await pool.query(
    `SELECT e.practice_published,
            EXISTS (SELECT 1 FROM ebook_purchases p WHERE p.user_id = $1 AND p.ebook_id = e.id AND p.payment_status = 'success') AS owns
     FROM ebooks e WHERE e.id = $2`,
    [req.userId, ebookId],
  );
  const row = r.rows[0];
  if (!row || !row.owns) { res.status(404).json({ error: "Bu kitap kitaplığında yok" }); return null; }
  if (!row.practice_published) { res.status(403).json({ error: "Bu kitabın pratikleri henüz hazırlanıyor" }); return null; }
  return ebookId;
}

function unitParam(q: unknown): number | null {
  const n = Number(q);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function approvedItems(ebookId: number, unit: number | null): Promise<QuizSourceItem[]> {
  const r = await pool.query(
    `SELECT id, kind, en, tr, example_en, unit_order FROM ebook_practice_items
     WHERE ebook_id = $1 AND status = 'approved' AND ($2::int IS NULL OR unit_order = $2)
     ORDER BY unit_order, position, id`,
    [ebookId, unit],
  );
  return r.rows.map((x: any) => ({ id: x.id, kind: x.kind, en: x.en, tr: x.tr, exampleEn: x.example_en, unitOrder: x.unit_order }));
}

router.get("/me/ebooks/:id/practice", authMiddleware, async (req: AuthRequest, res) => {
  const ebookId = await guard(req, res);
  if (!ebookId) return;
  const book = (await pool.query(`SELECT id, title, cover_image_url FROM ebooks WHERE id = $1`, [ebookId])).rows[0];
  const units = await pool.query(
    `SELECT i.unit_order, MIN(i.unit_title) AS title,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE i.kind = 'pattern')::int AS patterns,
            COUNT(*) FILTER (WHERE i.kind = 'term')::int AS terms,
            COUNT(p.item_id)::int AS seen,
            COUNT(p.item_id) FILTER (WHERE p.box >= $3)::int AS learned,
            COUNT(p.item_id) FILTER (WHERE p.due_at <= NOW())::int AS due
     FROM ebook_practice_items i
     LEFT JOIN ebook_practice_progress p ON p.item_id = i.id AND p.user_id = $2
     WHERE i.ebook_id = $1 AND i.status = 'approved'
     GROUP BY i.unit_order ORDER BY i.unit_order`,
    [ebookId, req.userId, LEARNED_BOX],
  );
  const best = await pool.query(
    `SELECT unit_order, MAX(ROUND(100.0 * correct / NULLIF(total, 0)))::int AS best
     FROM ebook_practice_quiz_attempts WHERE user_id = $1 AND ebook_id = $2 GROUP BY unit_order`,
    [req.userId, ebookId],
  );
  const bestMap = new Map(best.rows.map((x: any) => [x.unit_order ?? 0, x.best]));
  return res.json({
    book: { id: book.id, title: book.title, coverImageUrl: book.cover_image_url },
    units: units.rows.map((u: any) => ({
      order: u.unit_order, title: u.title || "Genel", total: u.total, patterns: u.patterns, terms: u.terms,
      seen: u.seen, learned: u.learned, due: u.due, bestQuiz: bestMap.get(u.unit_order) ?? null,
    })),
  });
});

router.get("/me/ebooks/:id/practice/cards", authMiddleware, async (req: AuthRequest, res) => {
  const ebookId = await guard(req, res);
  if (!ebookId) return;
  const unit = unitParam(req.query.unit);
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 20));
  const r = await pool.query(
    `SELECT i.id, i.kind, i.en, i.tr, i.explanation, i.example_en, i.example_tr, i.unit_order, i.unit_title,
            p.box, p.due_at
     FROM ebook_practice_items i
     LEFT JOIN ebook_practice_progress p ON p.item_id = i.id AND p.user_id = $2
     WHERE i.ebook_id = $1 AND i.status = 'approved' AND ($3::int IS NULL OR i.unit_order = $3)
       AND (p.item_id IS NULL OR p.due_at <= NOW())
     ORDER BY (p.item_id IS NULL), p.due_at, i.unit_order, i.position, i.id
     LIMIT $4`,
    [ebookId, req.userId, unit, limit],
  );
  return res.json({
    cards: r.rows.map((x: any) => ({
      id: x.id, kind: x.kind, en: x.en, tr: x.tr, explanation: x.explanation,
      exampleEn: x.example_en, exampleTr: x.example_tr, unitOrder: x.unit_order, unitTitle: x.unit_title,
      isNew: x.box === null, box: x.box ?? 0,
    })),
  });
});

router.post("/me/ebooks/practice/review", authMiddleware, async (req: AuthRequest, res) => {
  const itemId = Number(req.body?.itemId);
  const result = req.body?.result;
  if (!Number.isInteger(itemId) || (result !== "know" && result !== "again")) {
    return res.status(400).json({ error: "itemId ve result (know/again) gerekli" });
  }
  // Öğe, kullanıcının sahip olduğu ve yayındaki bir kitaba mı ait?
  const ok = await pool.query(
    `SELECT 1 FROM ebook_practice_items i JOIN ebooks e ON e.id = i.ebook_id
     WHERE i.id = $1 AND i.status = 'approved' AND e.practice_published
       AND EXISTS (SELECT 1 FROM ebook_purchases p WHERE p.user_id = $2 AND p.ebook_id = e.id AND p.payment_status = 'success')`,
    [itemId, req.userId],
  );
  if (!ok.rows.length) return res.status(404).json({ error: "Kart bulunamadı" });

  const cur = (await pool.query(`SELECT box FROM ebook_practice_progress WHERE user_id = $1 AND item_id = $2`, [req.userId, itemId])).rows[0];
  const n = nextReview(cur?.box ?? 0, result);
  await pool.query(
    `INSERT INTO ebook_practice_progress (user_id, item_id, box, due_at, correct, wrong, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id, item_id) DO UPDATE SET box = $3, due_at = $4,
       correct = ebook_practice_progress.correct + $5, wrong = ebook_practice_progress.wrong + $6, last_seen_at = NOW()`,
    [req.userId, itemId, n.box, n.dueAt, result === "know" ? 1 : 0, result === "again" ? 1 : 0],
  );
  return res.json({ ok: true, box: n.box, dueAt: n.dueAt.toISOString() });
});

router.get("/me/ebooks/:id/practice/quiz", authMiddleware, async (req: AuthRequest, res) => {
  const ebookId = await guard(req, res);
  if (!ebookId) return;
  const unit = unitParam(req.query.unit);
  const all = await approvedItems(ebookId, null);
  const poolItems = unit ? all.filter((x) => x.unitOrder === unit) : all;
  const questions = buildQuiz(poolItems, all, 10);
  if (questions.length < 3) return res.status(400).json({ error: "Bu bölüm için test oluşturacak kadar içerik yok" });
  return res.json({ unit, questions });
});

router.post("/me/ebooks/:id/practice/quiz-result", authMiddleware, async (req: AuthRequest, res) => {
  const ebookId = await guard(req, res);
  if (!ebookId) return;
  const correct = Number(req.body?.correct);
  const total = Number(req.body?.total);
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total < 1 || total > 50 || correct < 0 || correct > total) {
    return res.status(400).json({ error: "Geçersiz sonuç" });
  }
  await pool.query(
    `INSERT INTO ebook_practice_quiz_attempts (user_id, ebook_id, unit_order, correct, total) VALUES ($1, $2, $3, $4, $5)`,
    [req.userId, ebookId, unitParam(req.body?.unitOrder), correct, total],
  );
  // Testte yanlış yapılan öğeler kart tekrarında hemen öne gelsin
  const wrong = Array.isArray(req.body?.wrongItemIds) ? req.body.wrongItemIds.map(Number).filter(Number.isInteger).slice(0, 50) : [];
  if (wrong.length) {
    await pool.query(
      `INSERT INTO ebook_practice_progress (user_id, item_id, box, due_at, wrong)
       SELECT $1, i.id, 0, NOW(), 1 FROM ebook_practice_items i
       WHERE i.ebook_id = $2 AND i.status = 'approved' AND i.id = ANY($3::int[])
       ON CONFLICT (user_id, item_id) DO UPDATE SET box = 0, due_at = NOW(), wrong = ebook_practice_progress.wrong + 1`,
      [req.userId, ebookId, wrong],
    );
  }
  return res.json({ ok: true });
});

// ─── AI koç: ünitenin kalıplarıyla kısa iş senaryosu ───────────────────────

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY tanımlı değil");
  if (!_openai) _openai = new OpenAI({ fetch: openaiTrackedFetch, apiKey: process.env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 1 });
  return _openai;
}

export const COACH_MAX_TURNS = 8;

type CoachReply = { reply: string; tip: string | null; scene?: string | null };
type CoachFn = (system: string, messages: { role: "user" | "assistant"; content: string }[]) => Promise<CoachReply>;

const openaiCoach: CoachFn = async (system, messages) => {
  const r = await openai().chat.completions.create({
    model: process.env.EBOOK_COACH_MODEL || "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }, ...messages],
  });
  const d = JSON.parse(r.choices[0]?.message?.content ?? "{}");
  return { reply: String(d.reply ?? "").trim(), tip: d.tip ? String(d.tip).trim() : null, scene: d.scene ? String(d.scene).trim() : null };
};
let coach: CoachFn = openaiCoach;
export function setCoachForTests(fn: CoachFn | null) { coach = fn ?? openaiCoach; }

router.post("/me/ebooks/:id/practice/coach", authMiddleware, async (req: AuthRequest, res) => {
  const ebookId = await guard(req, res);
  if (!ebookId) return;
  const unit = unitParam(req.body?.unit);
  const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const valid = raw.filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string");
  const userTurns = valid.filter((m: any) => m.role === "user").length;
  const messages = valid
    .slice(-2 * COACH_MAX_TURNS - 1)
    .map((m: any) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 600) }));
  if (userTurns > COACH_MAX_TURNS) return res.status(400).json({ error: "Bu konuşma tamamlandı; yeni bir konuşma başlat." });

  const items = (await approvedItems(ebookId, unit)).filter((x) => x.kind === "pattern");
  const targets = (items.length ? items : await approvedItems(ebookId, unit)).slice(0, 8).map((x) => x.en);
  if (targets.length === 0) return res.status(400).json({ error: "Bu bölümde çalışılacak kalıp yok" });
  const unitTitle = unit
    ? (await pool.query(`SELECT unit_title FROM ebook_practice_items WHERE ebook_id = $1 AND unit_order = $2 LIMIT 1`, [ebookId, unit])).rows[0]?.unit_title ?? ""
    : "";
  const finishing = userTurns >= COACH_MAX_TURNS;

  const system = `You are a friendly business-English practice partner inside the Sphere English app. The learner is a Turkish professional.
Role-play a short, realistic workplace situation (a meeting or office conversation) about: "${unitTitle || "corporate communication & meetings"}".
Target phrases the learner should practise (from their book): ${targets.map((t) => `"${t}"`).join(", ")}.
Rules:
- Stay in character as a colleague. Speak natural English, 1–3 short sentences per turn, B1–B2 level.
- Create openings where the learner can naturally use a target phrase. Never list the phrases yourself.
- "tip": if the learner's last message has a clear mistake, or a target phrase would fit better, write ONE short tip in Turkish (max 25 words), optionally quoting the better English. Otherwise null.
- No grades, no certificates, no promises.
${messages.length === 0 ? `- This is the start: "scene" = one Turkish sentence describing the situation and the learner's role; "reply" = your opening line in English.` : `- "scene" = null.`}
${finishing ? `- This is the LAST turn: close the conversation politely in English in "reply"; in "tip" give a 1–2 sentence Turkish wrap-up of how they did.` : ""}
Respond ONLY with JSON: {"scene": string|null, "reply": string, "tip": string|null}`;

  try {
    const out = await coach(system, messages.length ? messages : [{ role: "user", content: "Start the role-play." }]);
    if (!out.reply) throw new Error("boş yanıt");
    const used = usedTargets(messages.filter((m: { role: string }) => m.role === "user").map((m: { content: string }) => m.content), targets);
    return res.json({ ...out, targets, used, turn: userTurns, maxTurns: COACH_MAX_TURNS, done: finishing });
  } catch (e: any) {
    console.error("[ebook-coach]", e?.message);
    return res.status(502).json({ error: "Koç şu an yanıt veremedi, birazdan tekrar dene." });
  }
});

export default router;
