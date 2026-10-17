/**
 * Merve ile Ders — öğrenci uçları (Pro; routes/index.ts'te proGuard ile mount edilir).
 *
 *   GET  /tutor/lessons                         ders kütüphanesi + öneri + devam eden oturum + kota
 *   POST /tutor/lessons/personal/start          hata defterinden kişiye özel ders
 *   POST /tutor/lessons/:slug/start             kütüphane dersini başlat
 *   GET  /tutor/lesson-sessions/:id             oturumu (devam etmek için) getir
 *   POST /tutor/lesson-sessions/:id/turn        cevap (multipart "audio" ya da JSON {text}); ?speak=0 sesli cevap istemez
 *   POST /tutor/lesson-sessions/:id/finish      dersten çık / özeti al
 *
 * Sesli kota: TUTOR_DAILY_VOICE_TURNS (varsayılan 80) — kullanıcı başına günlük sesli tur
 * (ses girişi + sesli cevap). Dolunca yazıyla devam edilir, sesli cevap gelmez.
 */

import { Router, type Response } from "express";
import multer from "multer";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth.js";
import { awardPoints } from "../lib/points.js";
import {
  aiAvailable, transcribeLearner, speak, evaluateTurn, openingLine, openingSpeech, closingLine,
  roleplayEnabled, roleplayMaxTurns, roleplayTurn, roleplayOpener, ROLEPLAY_TRANSITION,
  generatePersonalLesson, type LessonSnapshot, type Correction,
} from "../lib/tutor-lesson-engine.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const levelIdx = (l: string | null | undefined) => (l ? LEVELS.indexOf(l) : -1);

function dailyVoiceLimit(): number {
  const n = Number(process.env.TUTOR_DAILY_VOICE_TURNS);
  return Number.isFinite(n) && n >= 0 ? n : 80;
}

async function voiceTurnsToday(userId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM tutor_lesson_turns t
       JOIN tutor_lesson_sessions s ON s.id = t.session_id
      WHERE s.user_id = $1 AND t.role = 'merve' AND (t.meta->>'voiced')::boolean IS TRUE
        AND t.created_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'`,
    [userId],
  );
  return rows[0]?.n ?? 0;
}

async function loadUser(userId: number) {
  const { rows } = await pool.query(
    `SELECT id, first_name, current_level, sector FROM users WHERE id = $1`,
    [userId],
  );
  const u = rows[0] || {};
  return {
    firstName: (u.first_name as string | null) || null,
    level: (u.current_level as string | null) || null,
    sector: (u.sector as string | null) || null,
  };
}

function lessonFromRow(r: any): LessonSnapshot {
  return {
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    introTr: r.intro_tr,
    outroTr: r.outro_tr,
    steps: Array.isArray(r.steps) ? r.steps : [],
  };
}

function publicSession(s: any) {
  const lesson: LessonSnapshot = s.lesson_snapshot;
  return {
    id: s.id,
    kind: s.kind,
    status: s.status,
    title: lesson.title,
    summary: lesson.summary,
    phase: (s.phase ?? "steps") as "steps" | "roleplay",
    stepIndex: s.current_step,
    totalSteps: lesson.steps.length,
    steps: lesson.steps.map((st) => ({ key: st.key, goalTr: st.goalTr })),
    currentGoal: s.phase === "roleplay"
      ? "Gerçek konuşma: Merve karşı tarafı oynuyor. Öğrendiklerini kullan, istediğin kadar konuş."
      : lesson.steps[s.current_step]?.goalTr ?? null,
    currentHint: s.phase === "roleplay"
      ? `Kalıplar: ${lesson.steps.map((st) => st.targets[0]).join(" · ")}`
      : lesson.steps[s.current_step]?.hintTr ?? null,
    roleplayTurns: s.roleplay_turns ?? 0,
    roleplayMaxTurns: roleplayMaxTurns(),
    startedAt: s.started_at,
  };
}

async function buildSummary(sessionId: number) {
  const { rows: [s] } = await pool.query(`SELECT * FROM tutor_lesson_sessions WHERE id = $1`, [sessionId]);
  const { rows: turns } = await pool.query(
    `SELECT role, text, step_index, meta FROM tutor_lesson_turns WHERE session_id = $1 ORDER BY id`,
    [sessionId],
  );
  const lesson: LessonSnapshot = s.lesson_snapshot;
  const corrections: Correction[] = turns
    .filter((t: any) => t.role === "user" && t.meta?.correction)
    .map((t: any) => t.meta.correction);
  const stepsDone = s.status === "completed" || s.phase === "roleplay" ? lesson.steps.length : s.current_step;
  const learned = lesson.steps.slice(0, stepsDone).map((st) => ({ goalTr: st.goalTr, phrase: st.targets[0] }));
  const end = s.finished_at ? new Date(s.finished_at) : new Date(s.last_turn_at);
  return {
    title: lesson.title,
    completed: s.status === "completed",
    stepsDone,
    totalSteps: lesson.steps.length,
    turns: s.turns,
    roleplayTurns: s.roleplay_turns ?? 0,
    corrections,
    learned,
    durationSec: Math.max(0, Math.round((end.getTime() - new Date(s.started_at).getTime()) / 1000)),
  };
}

// ─── Kütüphane ────────────────────────────────────────────────────────────────

router.get("/tutor/lessons", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await loadUser(userId);
    const { rows } = await pool.query(
      `SELECT l.id, l.slug, l.title, l.summary, l.category, l.level_min, l.level_max, l.sectors, l.est_minutes,
              jsonb_array_length(l.steps) AS step_count, l.sort_order,
              COALESCE(p.completed, 0)::int AS completed_count,
              p.last_at
         FROM tutor_lessons l
         LEFT JOIN (
           SELECT lesson_id, COUNT(*) FILTER (WHERE status = 'completed') AS completed, MAX(started_at) AS last_at
             FROM tutor_lesson_sessions WHERE user_id = $1 GROUP BY lesson_id
         ) p ON p.lesson_id = l.id
        WHERE l.is_published = true
        ORDER BY l.sort_order, l.id`,
      [userId],
    );
    const li = levelIdx(user.level);
    const lessons = rows.map((r: any) => {
      const inLevel = li < 0 || (li >= levelIdx(r.level_min) && li <= levelIdx(r.level_max));
      const sectorMatch = !r.sectors?.length || (user.sector ? r.sectors.includes(user.sector) : false);
      return {
        slug: r.slug,
        title: r.title,
        summary: r.summary,
        category: r.category,
        levelMin: r.level_min,
        levelMax: r.level_max,
        estMinutes: r.est_minutes,
        stepCount: r.step_count,
        completedCount: r.completed_count,
        lastAt: r.last_at,
        recommended: inLevel && r.completed_count === 0 && (sectorMatch || !r.sectors?.length),
        aboveLevel: li >= 0 && li < levelIdx(r.level_min),
      };
    });
    const { rows: active } = await pool.query(
      `SELECT * FROM tutor_lesson_sessions
        WHERE user_id = $1 AND status = 'active' AND last_turn_at > NOW() - INTERVAL '24 hours'
        ORDER BY last_turn_at DESC LIMIT 1`,
      [userId],
    );
    const { rows: mist } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM user_mistakes WHERE user_id = $1 AND resolved_at IS NULL`,
      [userId],
    );
    const used = await voiceTurnsToday(userId);
    return res.json({
      teacher: { name: "Merve" },
      lessons,
      activeSession: active[0] ? publicSession(active[0]) : null,
      personalAvailable: (mist[0]?.n ?? 0) >= 2,
      voice: { usedToday: used, dailyLimit: dailyVoiceLimit(), available: aiAvailable() },
    });
  } catch (e: any) {
    console.error("[tutor-lessons] list:", e?.message);
    return res.status(500).json({ error: "Dersler alınamadı." });
  }
});

async function startSession(
  req: AuthRequest,
  res: Response,
  opts: { lessonId: number | null; kind: "library" | "personal"; lesson: LessonSnapshot },
) {
  const userId = req.userId!;
  const user = await loadUser(userId);
  const wantVoice = req.body?.speak !== false && req.query.speak !== "0";

  // Yarım kalan oturumları kapat (tek aktif ders)
  await pool.query(
    `UPDATE tutor_lesson_sessions SET status = 'abandoned', finished_at = NOW()
      WHERE user_id = $1 AND status = 'active'`,
    [userId],
  );

  const { rows: [s] } = await pool.query(
    `INSERT INTO tutor_lesson_sessions (user_id, lesson_id, kind, lesson_snapshot)
     VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
    [userId, opts.lessonId, opts.kind, JSON.stringify(opts.lesson)],
  );

  const text = openingLine(opts.lesson, user.firstName);
  const canVoice = wantVoice && (await voiceTurnsToday(userId)) < dailyVoiceLimit();
  const audioBase64 = canVoice ? await speak(openingSpeech(opts.lesson, user.firstName)) : null;
  await pool.query(
    `INSERT INTO tutor_lesson_turns (session_id, role, text, step_index, meta)
     VALUES ($1, 'merve', $2, 0, $3::jsonb)`,
    [s.id, text, JSON.stringify({ kind: "opening", voiced: Boolean(audioBase64) })],
  );
  awardPoints(userId, "module_open", { dailyCap: 5, silent: true }).catch(() => {});

  return res.status(201).json({
    session: publicSession(s),
    reply: { text, audioBase64 },
    voiceQuotaReached: wantVoice && !canVoice,
    voiceFailed: canVoice && aiAvailable() && !audioBase64,
  });
}

router.post("/tutor/lessons/personal/start", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { rows: mistakes } = await pool.query(
      `SELECT wrong_text, correct_text, explanation, context
         FROM user_mistakes
        WHERE user_id = $1 AND resolved_at IS NULL
        ORDER BY occurrence_count DESC, last_seen_at DESC
        LIMIT 4`,
      [userId],
    );
    if (mistakes.length < 2) {
      return res.status(400).json({
        error: "Sana özel ders için önce birkaç ders yapmalısın; hata defterinde yeterli kayıt yok.",
        code: "no_mistakes",
      });
    }
    if (!aiAvailable()) return res.status(503).json({ error: "Merve şu an ulaşılamıyor.", code: "ai_unavailable" });
    const user = await loadUser(userId);
    const lesson = await generatePersonalLesson({ mistakes, level: user.level, sector: user.sector });
    if (!lesson) return res.status(502).json({ error: "Ders hazırlanamadı, bir kez daha dener misin?" });
    return await startSession(req, res, { lessonId: null, kind: "personal", lesson });
  } catch (e: any) {
    console.error("[tutor-lessons] personal start:", e?.message);
    return res.status(500).json({ error: "Ders başlatılamadı." });
  }
});

router.post("/tutor/lessons/:slug/start", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tutor_lessons WHERE slug = $1 AND is_published = true`,
      [String(req.params.slug)],
    );
    if (!rows[0]) return res.status(404).json({ error: "Ders bulunamadı." });
    const lesson = lessonFromRow(rows[0]);
    if (lesson.steps.length === 0) return res.status(409).json({ error: "Bu dersin adımları henüz hazır değil." });
    return await startSession(req, res, { lessonId: rows[0].id, kind: "library", lesson });
  } catch (e: any) {
    console.error("[tutor-lessons] start:", e?.message);
    return res.status(500).json({ error: "Ders başlatılamadı." });
  }
});

// ─── Oturum ───────────────────────────────────────────────────────────────────

async function ownSession(userId: number, idRaw: string) {
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id)) return null;
  const { rows } = await pool.query(`SELECT * FROM tutor_lesson_sessions WHERE id = $1 AND user_id = $2`, [id, userId]);
  return rows[0] ?? null;
}

router.get("/tutor/lesson-sessions/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const s = await ownSession(req.userId!, String(req.params.id));
    if (!s) return res.status(404).json({ error: "Oturum bulunamadı." });
    const { rows: turns } = await pool.query(
      `SELECT id, role, text, input_mode, step_index, meta, created_at
         FROM tutor_lesson_turns WHERE session_id = $1 ORDER BY id`,
      [s.id],
    );
    return res.json({
      session: publicSession(s),
      turns: turns.map((t: any) => ({
        id: t.id, role: t.role, text: t.text, inputMode: t.input_mode, stepIndex: t.step_index,
        verdict: t.meta?.verdict ?? null, correction: t.meta?.correction ?? null, createdAt: t.created_at,
      })),
      summary: s.status === "completed" ? await buildSummary(s.id) : null,
    });
  } catch (e: any) {
    console.error("[tutor-lessons] get session:", e?.message);
    return res.status(500).json({ error: "Oturum alınamadı." });
  }
});

function recordMistake(userId: number, c: Correction, learnerText: string, sessionId: number, level: string | null, slug: string | null) {
  pool.query(
    `INSERT INTO user_mistakes (user_id, mistake_type, wrong_text, correct_text, explanation, context, source_module, source_ref, cefr_tag, tags)
     VALUES ($1, 'grammar', $2, $3, $4, $5, 'tutor_lesson', $6, $7, $8)`,
    [userId, c.original || learnerText, c.corrected, c.whyTr || null, learnerText, String(sessionId), level, [slug ?? "personal"]],
  ).catch(() => {});
}

router.post(
  "/tutor/lesson-sessions/:id/turn",
  authMiddleware,
  upload.single("audio"),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const s = await ownSession(userId, String(req.params.id));
      if (!s) return res.status(404).json({ error: "Oturum bulunamadı." });
      if (s.status !== "active") return res.status(409).json({ error: "Bu ders bitti. Yeni bir ders başlatabilirsin.", code: "not_active" });
      if (!aiAvailable()) return res.status(503).json({ error: "Merve şu an ulaşılamıyor, birazdan tekrar dene.", code: "ai_unavailable" });

      const lesson: LessonSnapshot = s.lesson_snapshot;
      const stepIndex: number = s.current_step;
      const phase: "steps" | "roleplay" = s.phase === "roleplay" ? "roleplay" : "steps";
      if (phase === "steps" && stepIndex >= lesson.steps.length) return res.status(409).json({ error: "Ders zaten tamamlandı.", code: "not_active" });

      const wantVoice = String(req.query.speak ?? req.body?.speak ?? "1") !== "0" && req.body?.speak !== false;
      const used = await voiceTurnsToday(userId);
      const limit = dailyVoiceLimit();

      // 1) Öğrencinin cevabı
      let learnerText = "";
      let inputMode: "voice" | "text" = "text";
      if (req.file) {
        if (req.file.buffer.length < 2500) {
          return res.status(400).json({ error: "Kayıt çok kısa geldi. Düğmeye bas, cümleni söyle, sonra bırak.", code: "too_short" });
        }
        if (used >= limit) {
          return res.status(429).json({ error: "Bugünlük sesli pratik hakkın doldu. Yazarak devam edebilirsin.", code: "voice_quota" });
        }
        inputMode = "voice";
        const t = await transcribeLearner(req.file.buffer, req.file.mimetype);
        learnerText = t.text;
      } else {
        learnerText = String(req.body?.text ?? "").trim();
      }
      learnerText = learnerText.slice(0, 600);
      if (!learnerText) {
        return res.status(400).json({ error: "Seni duyamadım. Biraz daha yüksek ve net söyler misin?", code: "empty" });
      }

      const user = await loadUser(userId);
      const { rows: hist } = await pool.query(
        `SELECT role, text FROM tutor_lesson_turns WHERE session_id = $1 ORDER BY id DESC LIMIT 12`,
        [s.id],
      );
      const history = hist.reverse();
      const canVoice = wantVoice && used < limit;

      // ── A) Gerçek konuşma (rol yapma) bölümü ────────────────────────────────
      if (phase === "roleplay") {
        const maxTurns = roleplayMaxTurns();
        const turnNo = (s.roleplay_turns ?? 0) + 1;
        const rp = await roleplayTurn({
          lesson, level: user.level, sector: user.sector, firstName: user.firstName,
          turnNo, maxTurns, history, learnerText,
        });
        const completed = rp.ended || turnNo >= maxTurns;
        const upd = await pool.query(
          `UPDATE tutor_lesson_sessions
              SET turns = turns + 1, roleplay_turns = roleplay_turns + 1,
                  voice_turns = voice_turns + $3, corrections = corrections + $4,
                  status = CASE WHEN $5 THEN 'completed' ELSE status END,
                  finished_at = CASE WHEN $5 THEN NOW() ELSE finished_at END,
                  last_turn_at = NOW()
            WHERE id = $1 AND roleplay_turns = $2 AND status = 'active'`,
          [s.id, turnNo - 1, inputMode === "voice" ? 1 : 0, rp.correction ? 1 : 0, completed],
        );
        if ((upd.rowCount ?? 0) === 0) return res.status(409).json({ error: "Bu cevap zaten işlendi.", code: "stale" });

        const closing = completed ? closingLine(lesson) : "";
        const replyText = `${rp.say} ${closing}`.replace(/\s+/g, " ").trim();
        const audioBase64 = canVoice
          ? await speak([{ text: rp.say }, { text: closing, cacheable: Boolean(lesson.slug) }].filter((p) => p.text.trim()))
          : null;
        await pool.query(
          `INSERT INTO tutor_lesson_turns (session_id, role, text, input_mode, step_index, meta)
           VALUES ($1, 'user', $2, $3, $4, $5::jsonb), ($1, 'merve', $6, NULL, $4, $7::jsonb)`,
          [
            s.id, learnerText, inputMode, stepIndex,
            JSON.stringify({ phase: "roleplay", verdict: rp.correction ? "almost" : "correct", correction: rp.correction }),
            replyText, JSON.stringify({ phase: "roleplay", voiced: Boolean(audioBase64) }),
          ],
        );
        if (rp.correction?.corrected) recordMistake(userId, rp.correction, learnerText, s.id, user.level, lesson.slug);
        awardPoints(userId, "tutor_lesson_turn", { dailyCap: 30, silent: true }).catch(() => {});
        if (completed) awardPoints(userId, "tutor_lesson_complete", { onceEverForRef: true, refId: `tutor-session-${s.id}`, silent: true }).catch(() => {});

        const { rows: [fresh] } = await pool.query(`SELECT * FROM tutor_lesson_sessions WHERE id = $1`, [s.id]);
        return res.json({
          learnerText, inputMode,
          verdict: rp.correction ? "almost" : "correct",
          correction: rp.correction,
          advanced: false,
          reply: { text: replyText, audioBase64 },
          session: publicSession(fresh),
          completed,
          summary: completed ? await buildSummary(s.id) : null,
          voiceQuotaReached: wantVoice && !canVoice,
          voiceFailed: canVoice && !audioBase64,
        });
      }

      // ── B) Adımlı bölüm ─────────────────────────────────────────────────────
      const evaluation = await evaluateTurn({
        lesson,
        stepIndex,
        attempts: s.step_attempts,
        level: user.level,
        firstName: user.firstName,
        sector: user.sector,
        history: history.slice(-8),
        learnerText,
      });

      // Adımı ilerlet (yarış koşuluna karşı current_step koşullu). Adımlar bitince ya gerçek konuşmaya geçilir ya ders biter.
      const nextIndex = evaluation.advance ? stepIndex + 1 : stepIndex;
      const stepsDone = nextIndex >= lesson.steps.length;
      const enterRoleplay = stepsDone && roleplayEnabled();
      const completed = stepsDone && !enterRoleplay;
      const upd = await pool.query(
        `UPDATE tutor_lesson_sessions
            SET current_step = $3,
                step_attempts = CASE WHEN $4 THEN 0 ELSE step_attempts + 1 END,
                turns = turns + 1,
                voice_turns = voice_turns + $5,
                corrections = corrections + $6,
                status = CASE WHEN $7 THEN 'completed' ELSE status END,
                finished_at = CASE WHEN $7 THEN NOW() ELSE finished_at END,
                phase = CASE WHEN $8 THEN 'roleplay' ELSE phase END,
                last_turn_at = NOW()
          WHERE id = $1 AND current_step = $2 AND status = 'active' AND phase = 'steps'`,
        [s.id, stepIndex, nextIndex, evaluation.advance, inputMode === "voice" ? 1 : 0, evaluation.correction ? 1 : 0, completed, enterRoleplay],
      );
      if ((upd.rowCount ?? 0) === 0) {
        return res.status(409).json({ error: "Bu cevap zaten işlendi.", code: "stale" });
      }

      // Merve'nin konuşması: tepki + (ilerlediyse) sonraki adımın kurgusu / gerçek konuşmaya geçiş / kapanış
      let opener = "";
      if (enterRoleplay) opener = await roleplayOpener({ lesson, level: user.level, sector: user.sector, firstName: user.firstName });
      const follow = !evaluation.advance ? ""
        : enterRoleplay ? ROLEPLAY_TRANSITION
        : completed ? closingLine(lesson)
        : lesson.steps[nextIndex].setupTr;
      const replyText = `${evaluation.say} ${follow} ${opener}`.replace(/\s+/g, " ").trim();

      // Tepki (dinamik) + sonraki adım/geçiş (sabit → önbellekten) + rol açılışı (dinamik): arada doğal duraklama
      const speechParts = [
        { text: evaluation.say },
        { text: follow, cacheable: Boolean(lesson.slug) || enterRoleplay },
        { text: opener },
      ].filter((p) => p.text.trim());
      const audioBase64 = canVoice ? await speak(speechParts) : null;

      await pool.query(
        `INSERT INTO tutor_lesson_turns (session_id, role, text, input_mode, step_index, meta)
         VALUES ($1, 'user', $2, $3, $4, $5::jsonb),
                ($1, 'merve', $6, NULL, $7, $8::jsonb)`,
        [
          s.id, learnerText, inputMode, stepIndex,
          JSON.stringify({ verdict: evaluation.verdict, correction: evaluation.correction }),
          replyText, stepsDone ? stepIndex : nextIndex,
          JSON.stringify({ voiced: Boolean(audioBase64), advanced: evaluation.advance, enteredRoleplay: enterRoleplay }),
        ],
      );

      // Hata defteri + puan
      if (evaluation.correction?.corrected) recordMistake(userId, evaluation.correction, learnerText, s.id, user.level, lesson.slug);
      awardPoints(userId, "tutor_lesson_turn", { dailyCap: 30, silent: true }).catch(() => {});
      if (completed) {
        awardPoints(userId, "tutor_lesson_complete", { onceEverForRef: true, refId: `tutor-session-${s.id}`, silent: true }).catch(() => {});
      }

      const { rows: [fresh] } = await pool.query(`SELECT * FROM tutor_lesson_sessions WHERE id = $1`, [s.id]);
      return res.json({
        learnerText,
        inputMode,
        verdict: evaluation.verdict,
        correction: evaluation.correction,
        advanced: evaluation.advance,
        reply: { text: replyText, audioBase64 },
        session: publicSession(fresh),
        completed,
        summary: completed ? await buildSummary(s.id) : null,
        voiceQuotaReached: wantVoice && !canVoice,
        voiceFailed: canVoice && !audioBase64,
      });
    } catch (e: any) {
      console.error("[tutor-lessons] turn:", e?.message);
      const timeout = /zaman aşımı|timeout/i.test(String(e?.message ?? ""));
      return res.status(timeout ? 504 : 500).json({
        error: timeout ? "Merve biraz yavaş kaldı, bir kez daha dener misin?" : "Bir hata oldu, tekrar dener misin?",
      });
    }
  },
);

router.post("/tutor/lesson-sessions/:id/finish", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const s = await ownSession(req.userId!, String(req.params.id));
    if (!s) return res.status(404).json({ error: "Oturum bulunamadı." });
    if (s.status === "active") {
      // Gerçek konuşma bölümüne geçmiş ders = adımlar bitti → tamamlandı sayılır; yoksa yarım kaldı
      const done = s.phase === "roleplay";
      await pool.query(
        `UPDATE tutor_lesson_sessions SET status = $2, finished_at = NOW() WHERE id = $1 AND status = 'active'`,
        [s.id, done ? "completed" : "abandoned"],
      );
      if (done) {
        awardPoints(req.userId!, "tutor_lesson_complete", { onceEverForRef: true, refId: `tutor-session-${s.id}`, silent: true }).catch(() => {});
      }
    }
    return res.json({ summary: await buildSummary(s.id) });
  } catch (e: any) {
    console.error("[tutor-lessons] finish:", e?.message);
    return res.status(500).json({ error: "Ders kapatılamadı." });
  }
});

export default router;
