/**
 * Speaking Role-Play Sahneleri
 *
 * Kullanıcı sektör bazlı bir sahne seçer, AI karşı taraf rolüyle konuşmayı
 * başlatır. Her turda kullanıcı hedef cümleyi söyler → Whisper transcript →
 * 4 skor (accuracy, fluency, pronunciation, completeness). Sahne bitince
 * özet rapor.
 *
 * Hybrid model:
 *   - user turu → text_en scripted, kullanıcı bu cümleyi söylemeli, skorlanır
 *   - ai turu → text_en scripted (MVP), TTS ile seslenir. Gelecekte GPT dinamik.
 *
 * Endpoint'ler (hepsi login + subscription/free tier'a göre):
 *   GET  /api/scenes                    → Kategori/liste + kullanıcının plan filtresi
 *   GET  /api/scenes/:slug              → Sahne detay
 *   POST /api/scenes/:slug/start        → Attempt başlat + ilk AI opening (audio+text)
 *   POST /api/scenes/attempts/:id/speak → Ses gönder → skor + bir sonraki AI turu
 *   POST /api/scenes/attempts/:id/complete → Sahneyi kapat + rapor
 *   GET  /api/scenes/attempts/history   → Kullanıcının geçmiş sahne denemeleri
 *   GET  /api/scenes/attempts/:id       → Attempt detay
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import OpenAI from "openai";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth.js";

const execFileAsync = promisify(execFile);
const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY ortam değişkeni ayarlanmamış");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── Plan tier + quota ──────────────────────────────────────────────────
type PlanTier = "free" | "pro";

const FREE_DAILY_LIMIT = 2;
const FREE_ALLOWED_CATEGORIES = ["general_business", "meetings"];

async function getUserTier(userId: number): Promise<PlanTier> {
  try {
    const rows = await db.execute(sql`
      SELECT status FROM subscriptions WHERE user_id = ${userId} LIMIT 1
    `);
    const status = ((rows.rows ?? rows)[0] as any)?.status;
    if (status === "active" || status === "trialing") return "pro";
    return "free";
  } catch {
    return "free";
  }
}

async function getTodayAttemptCount(userId: number): Promise<number> {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM speaking_scene_attempts
    WHERE user_id = ${userId}
      AND started_at > NOW() - INTERVAL '24 hours'
      AND status IN ('in_progress','completed')
  `);
  return Number(((rows.rows ?? rows)[0] as any)?.n ?? 0);
}

async function assertQuota(
  userId: number,
  sceneCategory: string,
  sceneMinPlan: PlanTier,
): Promise<{ ok: true } | { ok: false; error: string; upgrade?: boolean }> {
  const tier = await getUserTier(userId);

  // Plan tier check
  if (sceneMinPlan === "pro" && tier === "free") {
    return { ok: false, error: "Bu sahne Pro aboneler içindir.", upgrade: true };
  }

  if (tier === "free") {
    // Kategori limiti
    if (!FREE_ALLOWED_CATEGORIES.includes(sceneCategory)) {
      return {
        ok: false,
        error: "Bu kategori Pro abonelere özel. Ücretsiz kategorilerden birini dene.",
        upgrade: true,
      };
    }
    // Günlük limit
    const count = await getTodayAttemptCount(userId);
    if (count >= FREE_DAILY_LIMIT) {
      return {
        ok: false,
        error: `Günlük ${FREE_DAILY_LIMIT} sahne hakkın doldu. Pro'ya geçerek sınırsız pratik yap.`,
        upgrade: true,
      };
    }
  }

  return { ok: true };
}

// ─── Whisper transcript + ffmpeg ────────────────────────────────────────
async function convertToMp3(inputBuffer: Buffer): Promise<Buffer> {
  const tmpIn = path.join(os.tmpdir(), `scene_in_${Date.now()}.webm`);
  const tmpOut = path.join(os.tmpdir(), `scene_out_${Date.now()}.mp3`);
  try {
    fs.writeFileSync(tmpIn, inputBuffer);
    await execFileAsync("ffmpeg", [
      "-y", "-i", tmpIn,
      "-vn", "-ar", "16000", "-ac", "1",
      "-b:a", "32k", "-threads", "0",
      tmpOut,
    ]);
    return fs.readFileSync(tmpOut);
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

async function transcribeAudio(
  audioBuffer: Buffer,
): Promise<{ text: string; words: WhisperWord[]; durationMs: number } | null> {
  try {
    let finalBuffer = audioBuffer;
    let ext = "mp3";
    let mime = "audio/mpeg";
    try {
      finalBuffer = await convertToMp3(audioBuffer);
    } catch {
      ext = "webm";
      mime = "audio/webm";
    }

    const file = new File([finalBuffer], `audio.${ext}`, { type: mime });
    const t0 = Date.now();
    const res: any = await getOpenAI().audio.transcriptions.create({
      model: "whisper-1",
      file,
      language: "en",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      temperature: 0.1,
      prompt: "English learner practicing scripted business dialog. Transcribe exactly as said.",
    } as any);

    const words: WhisperWord[] = (res.words || []).map((w: any) => ({
      word: (w.word || "").trim(),
      start: w.start ?? 0,
      end: w.end ?? 0,
      probability: w.probability ?? 1,
    }));
    return {
      text: String(res.text || "").trim(),
      words,
      durationMs: Date.now() - t0,
    };
  } catch (e: any) {
    console.error("[scenes] Whisper HATA:", e?.message);
    return null;
  }
}

// ─── Skorlama ───────────────────────────────────────────────────────────

// Metin normalize — karşılaştırma için (küçük harf, punctuation temizle)
function normalize(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Word-level Levenshtein-benzeri karşılaştırma (edit distance)
function alignWords(target: string[], said: string[]): Array<{
  target: string | null;
  said: string | null;
  match: "exact" | "close" | "missing" | "extra";
}> {
  // Dinamik programlama ile edit distance ve back-trace
  const m = target.length;
  const n = said.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = target[i - 1] === said[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  // Back-trace
  const result: Array<{ target: string | null; said: string | null; match: any }> = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && target[i - 1] === said[j - 1]) {
      result.push({ target: target[i - 1], said: said[j - 1], match: "exact" });
      i--; j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      // Substitution — telaffuz farkı
      const similarity =
        1 -
        Math.min(
          Math.abs(target[i - 1].length - said[j - 1].length),
          Math.max(target[i - 1].length, said[j - 1].length),
        ) /
          Math.max(target[i - 1].length, said[j - 1].length, 1);
      result.push({
        target: target[i - 1],
        said: said[j - 1],
        match: similarity > 0.5 ? "close" : "missing",
      });
      i--; j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      result.push({ target: target[i - 1], said: null, match: "missing" });
      i--;
    } else {
      result.push({ target: null, said: said[j - 1], match: "extra" });
      j--;
    }
  }
  return result.reverse();
}

interface Scores {
  accuracy: number;
  fluency: number;
  pronunciation: number;
  completeness: number;
  overall: number;
}

function computeScores(
  targetText: string,
  transcript: string,
  whisperWords: WhisperWord[],
  audioMs: number,
): { scores: Scores; wordAnalysis: any[] } {
  const targetWords = normalize(targetText).split(" ").filter(Boolean);
  const saidWords = normalize(transcript).split(" ").filter(Boolean);

  if (targetWords.length === 0) {
    return {
      scores: { accuracy: 0, fluency: 0, pronunciation: 0, completeness: 0, overall: 0 },
      wordAnalysis: [],
    };
  }

  const aligned = alignWords(targetWords, saidWords);

  // Accuracy: exact + close eşleşme oranı
  const exactCount = aligned.filter((a) => a.match === "exact").length;
  const closeCount = aligned.filter((a) => a.match === "close").length;
  const accuracy = Math.round(
    ((exactCount + closeCount * 0.5) / targetWords.length) * 100,
  );

  // Completeness: söylenen target kelimeler / toplam target
  const completeness = Math.round(
    ((exactCount + closeCount) / targetWords.length) * 100,
  );

  // Pronunciation: Whisper confidence ortalaması (whisper transcript'te bulunan word'ler için)
  let pronScore = 100;
  if (whisperWords.length > 0) {
    const avgProb =
      whisperWords.reduce((s, w) => s + Math.max(0, Math.min(1, w.probability)), 0) /
      whisperWords.length;
    pronScore = Math.round(avgProb * 100);
  }

  // Fluency: WPM (kelime/dakika) hedefi 100-140
  const audioSeconds = Math.max(1, audioMs / 1000);
  const wpm = (saidWords.length / audioSeconds) * 60;
  let fluency = 100;
  if (wpm < 60) fluency = Math.round((wpm / 60) * 80);
  else if (wpm > 180) fluency = Math.round(100 - Math.min(30, (wpm - 180) / 3));
  else if (wpm < 100) fluency = Math.round(80 + ((wpm - 60) / 40) * 20);
  fluency = Math.max(0, Math.min(100, fluency));

  const overall = Math.round(
    accuracy * 0.35 +
      pronScore * 0.3 +
      completeness * 0.2 +
      fluency * 0.15,
  );

  // Word-level analiz — front-end renkli gösterecek
  const wordAnalysis = aligned.map((a) => ({
    target: a.target,
    said: a.said,
    match: a.match,
  }));

  return {
    scores: {
      accuracy: Math.max(0, Math.min(100, accuracy)),
      fluency,
      pronunciation: Math.max(0, Math.min(100, pronScore)),
      completeness: Math.max(0, Math.min(100, completeness)),
      overall: Math.max(0, Math.min(100, overall)),
    },
    wordAnalysis,
  };
}

// ─── ENDPOINTS ──────────────────────────────────────────────────────────

// GET /api/scenes — Kategorileri ve sahneleri listele
router.get("/scenes", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const tier = await getUserTier(userId);
    const category = req.query.category ? String(req.query.category) : null;

    const rows = await db.execute(sql`
      SELECT id, slug, category, title_en, title_tr, description_tr,
             user_role_tr, counterpart_role_tr, difficulty, min_plan,
             avg_duration_min, sort_order
      FROM speaking_scenes
      WHERE is_active = TRUE
        ${category ? sql`AND category = ${category}` : sql``}
      ORDER BY sort_order ASC, id ASC
    `);
    const scenes = (rows.rows ?? rows) as any[];

    // Kullanıcının kilit durumunu ekle
    const withLock = scenes.map((s) => ({
      ...s,
      locked:
        tier === "free" &&
        (s.min_plan === "pro" || !FREE_ALLOWED_CATEGORIES.includes(s.category)),
      lock_reason:
        tier === "free" && s.min_plan === "pro"
          ? "pro_only"
          : tier === "free" && !FREE_ALLOWED_CATEGORIES.includes(s.category)
            ? "category_locked"
            : null,
    }));

    // Kullanıcının bugünkü limit durumu
    let dailyRemaining: number | null = null;
    if (tier === "free") {
      const used = await getTodayAttemptCount(userId);
      dailyRemaining = Math.max(0, FREE_DAILY_LIMIT - used);
    }

    return res.json({
      tier,
      dailyRemaining,
      dailyLimit: tier === "free" ? FREE_DAILY_LIMIT : null,
      scenes: withLock,
    });
  } catch (e: any) {
    console.error("[scenes] list HATA:", e?.message);
    return res.status(500).json({ error: "Sahneler listelenemedi" });
  }
});

// GET /api/scenes/:slug — Sahne detay + turlar
router.get("/scenes/:slug", authMiddleware, async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug ?? "").trim();
    if (!slug) return res.status(400).json({ error: "slug gerekli" });

    const rows = await db.execute(sql`
      SELECT id, slug, category, title_en, title_tr, description_tr,
             user_role_tr, counterpart_role_tr, difficulty, min_plan,
             avg_duration_min, voice
      FROM speaking_scenes
      WHERE slug = ${slug} AND is_active = TRUE
      LIMIT 1
    `);
    const scene = (rows.rows ?? rows)[0] as any;
    if (!scene) return res.status(404).json({ error: "Sahne bulunamadı" });

    // Turları da göster (preview olarak, ama user turları görünür kalsın — kullanıcı zaten okuyacak)
    const turnsRows = await db.execute(sql`
      SELECT id, turn_order, speaker, text_en, text_tr, notes_tr, phonetic_hint
      FROM speaking_scene_turns
      WHERE scene_id = ${scene.id}
      ORDER BY turn_order ASC
    `);
    const turns = (turnsRows.rows ?? turnsRows) as any[];

    return res.json({ scene, turns });
  } catch (e: any) {
    console.error("[scenes] detail HATA:", e?.message);
    return res.status(500).json({ error: "Sahne detayı alınamadı" });
  }
});

// POST /api/scenes/:slug/start — Attempt başlat
router.post(
  "/scenes/:slug/start",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const slug = String(req.params.slug ?? "").trim();

      const sceneRows = await db.execute(sql`
        SELECT id, category, min_plan, voice FROM speaking_scenes
        WHERE slug = ${slug} AND is_active = TRUE LIMIT 1
      `);
      const scene = (sceneRows.rows ?? sceneRows)[0] as any;
      if (!scene) return res.status(404).json({ error: "Sahne bulunamadı" });

      const q = await assertQuota(userId, scene.category, scene.min_plan);
      if (!q.ok) return res.status(403).json({ error: q.error, upgrade: q.upgrade });

      // Attempt oluştur
      const ins = await db.execute(sql`
        INSERT INTO speaking_scene_attempts (user_id, scene_id, status, turn_count)
        VALUES (${userId}, ${scene.id}, 'in_progress', 0)
        RETURNING id, started_at
      `);
      const attempt = (ins.rows ?? ins)[0] as any;

      // İlk AI turu — turn_order 1 (AI opening)
      const firstAiTurnRows = await db.execute(sql`
        SELECT id, turn_order, text_en, text_tr, notes_tr
        FROM speaking_scene_turns
        WHERE scene_id = ${scene.id} AND speaker = 'ai'
        ORDER BY turn_order ASC LIMIT 1
      `);
      const firstAi = (firstAiTurnRows.rows ?? firstAiTurnRows)[0] as any;

      let openingAudio: string | null = null;
      if (firstAi) {
        try {
          const tts = await getOpenAI().audio.speech.create({
            model: "tts-1",
            voice: scene.voice || "nova",
            input: firstAi.text_en,
            speed: 0.95,
          });
          openingAudio = Buffer.from(await tts.arrayBuffer()).toString("base64");
        } catch (ttsErr: any) {
          console.error("[scenes] TTS HATA:", ttsErr?.message);
        }
      }

      // Bir sonraki user turu (turn_order 2 genellikle)
      const nextUserTurnRows = await db.execute(sql`
        SELECT id, turn_order, text_en, text_tr, notes_tr, phonetic_hint
        FROM speaking_scene_turns
        WHERE scene_id = ${scene.id} AND speaker = 'user'
        ORDER BY turn_order ASC LIMIT 1
      `);
      const nextUser = (nextUserTurnRows.rows ?? nextUserTurnRows)[0] as any;

      return res.json({
        attemptId: attempt.id,
        startedAt: attempt.started_at,
        aiTurn: firstAi
          ? {
              turnId: firstAi.id,
              turnOrder: firstAi.turn_order,
              text: firstAi.text_en,
              textTr: firstAi.text_tr,
              notesTr: firstAi.notes_tr,
              audioBase64: openingAudio,
            }
          : null,
        nextUserTurn: nextUser
          ? {
              turnId: nextUser.id,
              turnOrder: nextUser.turn_order,
              text: nextUser.text_en,
              textTr: nextUser.text_tr,
              notesTr: nextUser.notes_tr,
              phoneticHint: nextUser.phonetic_hint,
            }
          : null,
      });
    } catch (e: any) {
      console.error("[scenes] start HATA:", e?.message);
      return res.status(500).json({ error: "Sahne başlatılamadı" });
    }
  },
);

// POST /api/scenes/attempts/:attemptId/speak — Ses gönder, skor + sonraki AI turu
router.post(
  "/scenes/attempts/:attemptId/speak",
  authMiddleware,
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const attemptId = parseInt(String(req.params.attemptId ?? ""), 10);
      const turnId = req.body?.turnId ? parseInt(String(req.body.turnId), 10) : null;

      if (!Number.isFinite(attemptId))
        return res.status(400).json({ error: "Geçersiz attemptId" });
      if (!req.file || req.file.buffer.length < 2000)
        return res.status(400).json({ error: "Ses kaydı çok kısa. En az 2 saniye konuş." });

      // Attempt sahiplik kontrolü + sahne bilgisi
      const attRows = await db.execute(sql`
        SELECT a.id, a.scene_id, a.user_id, a.status, a.turn_count,
               s.voice
        FROM speaking_scene_attempts a
        INNER JOIN speaking_scenes s ON s.id = a.scene_id
        WHERE a.id = ${attemptId} LIMIT 1
      `);
      const att = (attRows.rows ?? attRows)[0] as any;
      if (!att) return res.status(404).json({ error: "Attempt bulunamadı" });
      if (Number(att.user_id) !== userId)
        return res.status(403).json({ error: "Yetkisiz" });
      if (att.status !== "in_progress")
        return res.status(400).json({ error: "Sahne tamamlanmış" });

      // Hedef turu bul
      let targetTurn: any = null;
      if (turnId) {
        const tRows = await db.execute(sql`
          SELECT id, turn_order, text_en, text_tr
          FROM speaking_scene_turns
          WHERE id = ${turnId} AND scene_id = ${att.scene_id} AND speaker = 'user' LIMIT 1
        `);
        targetTurn = (tRows.rows ?? tRows)[0];
      }
      if (!targetTurn) return res.status(400).json({ error: "Hedef tur bulunamadı" });

      // Whisper transcript
      const whisper = await transcribeAudio(req.file.buffer);
      if (!whisper) {
        return res.status(502).json({ error: "Ses tanıma başarısız. Tekrar dene." });
      }

      // Skorla
      const { scores, wordAnalysis } = computeScores(
        String(targetTurn.text_en),
        whisper.text,
        whisper.words,
        whisper.durationMs,
      );

      // Turn attempt kaydet
      await db.execute(sql`
        INSERT INTO speaking_scene_turn_attempts (
          attempt_id, turn_id, turn_order,
          target_text, transcript,
          accuracy_score, fluency_score, pronunciation_score,
          completeness_score, overall_score,
          word_analysis, duration_ms
        ) VALUES (
          ${attemptId}, ${targetTurn.id}, ${targetTurn.turn_order},
          ${String(targetTurn.text_en)}, ${whisper.text},
          ${scores.accuracy}, ${scores.fluency}, ${scores.pronunciation},
          ${scores.completeness}, ${scores.overall},
          ${JSON.stringify(wordAnalysis)}::jsonb, ${whisper.durationMs}
        )
      `);

      // Attempt turn_count arttır
      await db.execute(sql`
        UPDATE speaking_scene_attempts
        SET turn_count = turn_count + 1
        WHERE id = ${attemptId}
      `);

      // Sonraki turu bul (mevcut turn_order + 1)
      const nextRows = await db.execute(sql`
        SELECT id, turn_order, speaker, text_en, text_tr, notes_tr, phonetic_hint
        FROM speaking_scene_turns
        WHERE scene_id = ${att.scene_id} AND turn_order > ${targetTurn.turn_order}
        ORDER BY turn_order ASC LIMIT 2
      `);
      const nextTurns = (nextRows.rows ?? nextRows) as any[];
      const nextAi = nextTurns.find((t) => t.speaker === "ai") ?? null;
      const nextUser = nextTurns.find((t) => t.speaker === "user") ?? null;

      // AI turu varsa TTS üret
      let aiAudio: string | null = null;
      if (nextAi) {
        try {
          const tts = await getOpenAI().audio.speech.create({
            model: "tts-1",
            voice: att.voice || "nova",
            input: nextAi.text_en,
            speed: 0.95,
          });
          aiAudio = Buffer.from(await tts.arrayBuffer()).toString("base64");
        } catch (ttsErr: any) {
          console.error("[scenes] speak TTS HATA:", ttsErr?.message);
        }
      }

      // Sahne bitti mi?
      const isLastTurn = !nextAi && !nextUser;

      return res.json({
        transcript: whisper.text,
        target: String(targetTurn.text_en),
        scores,
        wordAnalysis,
        aiTurn: nextAi
          ? {
              turnId: nextAi.id,
              turnOrder: nextAi.turn_order,
              text: nextAi.text_en,
              textTr: nextAi.text_tr,
              audioBase64: aiAudio,
            }
          : null,
        nextUserTurn: nextUser
          ? {
              turnId: nextUser.id,
              turnOrder: nextUser.turn_order,
              text: nextUser.text_en,
              textTr: nextUser.text_tr,
              phoneticHint: nextUser.phonetic_hint,
              notesTr: nextUser.notes_tr,
            }
          : null,
        isLastTurn,
      });
    } catch (e: any) {
      console.error("[scenes] speak HATA:", e?.message, e?.stack);
      return res.status(500).json({ error: "Ses işlenemedi: " + e?.message });
    }
  },
);

// POST /api/scenes/attempts/:attemptId/complete — Sahneyi bitir + rapor
router.post(
  "/scenes/attempts/:attemptId/complete",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as number;
      const attemptId = parseInt(String(req.params.attemptId ?? ""), 10);

      const attRows = await db.execute(sql`
        SELECT id, user_id, status, started_at FROM speaking_scene_attempts
        WHERE id = ${attemptId} LIMIT 1
      `);
      const att = (attRows.rows ?? attRows)[0] as any;
      if (!att) return res.status(404).json({ error: "Attempt bulunamadı" });
      if (Number(att.user_id) !== userId)
        return res.status(403).json({ error: "Yetkisiz" });
      if (att.status === "completed")
        return res.status(400).json({ error: "Zaten tamamlanmış" });

      // Turn skorları
      const turnRows = await db.execute(sql`
        SELECT overall_score, accuracy_score, fluency_score,
               pronunciation_score, completeness_score
        FROM speaking_scene_turn_attempts
        WHERE attempt_id = ${attemptId}
      `);
      const turns = (turnRows.rows ?? turnRows) as any[];

      if (turns.length === 0) {
        // Hiç deneme yok → abandoned
        await db.execute(sql`
          UPDATE speaking_scene_attempts
          SET status = 'abandoned', completed_at = NOW()
          WHERE id = ${attemptId}
        `);
        return res.json({ status: "abandoned" });
      }

      const avg = (key: string) =>
        Math.round(turns.reduce((s, t) => s + Number(t[key] ?? 0), 0) / turns.length);

      const totalScore = avg("overall_score");
      const accAvg = avg("accuracy_score");
      const fluAvg = avg("fluency_score");
      const proAvg = avg("pronunciation_score");
      const cmpAvg = avg("completeness_score");

      const startedAt = new Date(att.started_at);
      const durationSec = Math.round((Date.now() - startedAt.getTime()) / 1000);

      // Zayıf alan tespit
      const weakAreas: string[] = [];
      if (accAvg < 70) weakAreas.push("Doğruluk (kelime seçimi)");
      if (fluAvg < 70) weakAreas.push("Akıcılık (konuşma hızı)");
      if (proAvg < 70) weakAreas.push("Telaffuz");
      if (cmpAvg < 70) weakAreas.push("Tamlık (eksik kelime)");

      const summary =
        totalScore >= 85
          ? "Harika bir performans! Bu sahneyi çok iyi geçtin, benzer sahneleri deneyebilirsin."
          : totalScore >= 70
            ? "İyi bir çalışma. Zayıf alanları biraz daha pratik yaparak yükseltebilirsin."
            : "İyi bir başlangıç. Aynı sahneyi tekrar edip skorunu yükseltmeyi dene.";

      await db.execute(sql`
        UPDATE speaking_scene_attempts SET
          status = 'completed',
          completed_at = NOW(),
          total_score = ${totalScore},
          duration_seconds = ${durationSec},
          ai_summary_tr = ${summary},
          weak_areas = ${JSON.stringify(weakAreas)}::jsonb
        WHERE id = ${attemptId}
      `);

      return res.json({
        status: "completed",
        totalScore,
        scores: {
          accuracy: accAvg,
          fluency: fluAvg,
          pronunciation: proAvg,
          completeness: cmpAvg,
        },
        turnCount: turns.length,
        durationSeconds: durationSec,
        weakAreas,
        aiSummary: summary,
      });
    } catch (e: any) {
      console.error("[scenes] complete HATA:", e?.message);
      return res.status(500).json({ error: "Sahne kapatılamadı" });
    }
  },
);

// GET /api/scenes/attempts/history — Kullanıcının geçmiş sahneleri
router.get("/scenes/attempts/history", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const limit = Math.min(50, parseInt(String(req.query.limit ?? "20"), 10) || 20);

    const rows = await db.execute(sql`
      SELECT a.id, a.scene_id, a.status, a.total_score, a.turn_count,
             a.duration_seconds, a.started_at, a.completed_at,
             s.slug, s.title_en, s.title_tr, s.category, s.difficulty
      FROM speaking_scene_attempts a
      INNER JOIN speaking_scenes s ON s.id = a.scene_id
      WHERE a.user_id = ${userId}
      ORDER BY a.started_at DESC
      LIMIT ${limit}
    `);

    return res.json({ attempts: (rows.rows ?? rows) as any[] });
  } catch (e: any) {
    console.error("[scenes] history HATA:", e?.message);
    return res.status(500).json({ error: "Geçmiş alınamadı" });
  }
});

// GET /api/scenes/attempts/:id — Attempt detay + turn detayları
router.get("/scenes/attempts/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(String(req.params.id ?? ""), 10);

    const attRows = await db.execute(sql`
      SELECT a.*, s.slug, s.title_en, s.title_tr, s.category, s.difficulty
      FROM speaking_scene_attempts a
      INNER JOIN speaking_scenes s ON s.id = a.scene_id
      WHERE a.id = ${id} LIMIT 1
    `);
    const att = (attRows.rows ?? attRows)[0] as any;
    if (!att) return res.status(404).json({ error: "Bulunamadı" });
    if (Number(att.user_id) !== userId)
      return res.status(403).json({ error: "Yetkisiz" });

    const turnRows = await db.execute(sql`
      SELECT id, turn_order, target_text, transcript,
             accuracy_score, fluency_score, pronunciation_score,
             completeness_score, overall_score, word_analysis
      FROM speaking_scene_turn_attempts
      WHERE attempt_id = ${id}
      ORDER BY turn_order ASC
    `);

    return res.json({
      attempt: att,
      turns: (turnRows.rows ?? turnRows) as any[],
    });
  } catch (e: any) {
    console.error("[scenes] detail HATA:", e?.message);
    return res.status(500).json({ error: "Detay alınamadı" });
  }
});

export default router;
