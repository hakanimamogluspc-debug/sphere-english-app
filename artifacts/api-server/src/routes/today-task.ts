/**
 * Today Task — Kullanıcının günlük mini-görevi.
 *
 * Retention için kritik: Kullanıcı sisteme girince 15 modül arasında
 * paralize olmasın diye TEK bir mini-görev sun. Sektörü + hedefi +
 * seviyesine göre AI ile kişiselleştirilir.
 *
 * Endpoint'ler:
 *   GET  /api/student/today-task       — bugünkü görevi getir (cache'li)
 *   POST /api/student/today-task/skip  — bugünkü görevi atla (yeni görev üret)
 *   POST /api/student/today-task/complete — tamamlandı işaretle
 *
 * Cache: user_id + tarih key'i ile aynı gün aynı görev döner.
 */

import { Router, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { getUserLevel } from "../lib/user-level";

const router = Router();

const TASK_TYPES = ["vocab_quiz", "reading", "scene", "tutor_prompt", "writing_prompt"] as const;
type TaskType = (typeof TASK_TYPES)[number];

interface TodayTask {
  type: TaskType;
  title_tr: string;
  description_tr: string;
  cta_label_tr: string;
  href: string;
  duration_min: number;
  level: string;
  sector?: string;
  goal?: string;
}

const SECTOR_LABELS_TR: Record<string, string> = {
  finance: "finans",
  tech: "teknoloji",
  manufacturing: "üretim",
  consulting: "danışmanlık",
  healthcare: "sağlık",
  hospitality: "turizm",
  hr: "İK",
  sales: "satış",
  legal: "hukuk",
  education: "eğitim",
  other: "iş",
};

const GOAL_LABELS_TR: Record<string, string> = {
  interview: "iş görüşmesi",
  meetings: "toplantı",
  presentation: "sunum",
  email: "iş email",
  customer: "müşteri iletişimi",
  certificate: "CEFR sertifikası",
  general: "genel akıcılık",
};

/**
 * Kullanıcının seviyesi + sektör + hedefine göre bir görev seç.
 * Deterministic — aynı day+userId için aynı görev.
 */
function pickTaskForUser(opts: {
  userId: number;
  level: string;
  sector: string | null;
  goal: string | null;
  date: string; // YYYY-MM-DD
}): TodayTask {
  const { userId, level, sector, goal, date } = opts;

  // Deterministic random seed: userId + date → task type seçimi
  const seed = (userId * 31 + hashString(date)) % TASK_TYPES.length;
  const type = TASK_TYPES[seed];

  const sectorLabel = sector ? SECTOR_LABELS_TR[sector] ?? "iş" : "iş";
  const goalLabel = goal ? GOAL_LABELS_TR[goal] ?? "genel akıcılık" : "genel akıcılık";

  switch (type) {
    case "vocab_quiz":
      return {
        type,
        title_tr: `${level} seviyesinde ${sectorLabel} kelimeleri`,
        description_tr: `Bugün ${sectorLabel} sektörüne özel 15 iş İngilizcesi kelimesini oyunlaştırarak öğren.`,
        cta_label_tr: "Kelime Oyununa Başla",
        href: "/student/vocab-game",
        duration_min: 5,
        level,
        sector: sector ?? undefined,
      };

    case "reading":
      return {
        type,
        title_tr: `${sectorLabel} sektöründen kısa bir makale oku`,
        description_tr: `${level} seviyesinde ilgi çekici bir makale — Türkçe özetle birlikte.`,
        cta_label_tr: "Keşfet'e Git",
        href: "/kesfet",
        duration_min: 8,
        level,
        sector: sector ?? undefined,
      };

    case "scene":
      return {
        type,
        title_tr: goal === "meetings"
          ? "Toplantı senaryosunda konuş"
          : goal === "presentation"
          ? "Sunum senaryosunda konuş"
          : "İş senaryosunda konuş",
        description_tr: `${level} seviyesinde bir konuşma sahnesinde AI ile rol yap. Telaffuz + akıcılık puanı al.`,
        cta_label_tr: "Sahneye Başla",
        href: "/student/speaking-scenes",
        duration_min: 5,
        level,
        goal: goal ?? undefined,
      };

    case "tutor_prompt":
      return {
        type,
        title_tr: "Kişisel öğretmeninle sohbet et",
        description_tr: `${goalLabel} konusunda aklına takılan bir şey sor — AI öğretmenin ${level} seviyende Türkçe destekle cevaplayacak.`,
        cta_label_tr: "Öğretmene Sor",
        href: "/student/ai-tutor",
        duration_min: 10,
        level,
        goal: goal ?? undefined,
      };

    case "writing_prompt":
      return {
        type,
        title_tr: goal === "email"
          ? "Bir iş email'i yaz ve analiz ettir"
          : "Kısa bir iş yazısı yap ve düzelttir",
        description_tr: `Kısa bir metin yaz, AI ${level} seviyesinde dilbilgisi + ton + akıcılık geri bildirimi versin.`,
        cta_label_tr: "Yazma Koçuna Git",
        href: "/student/writing-coach",
        duration_min: 8,
        level,
        goal: goal ?? undefined,
      };
  }
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── DB tablosu (setup) ────────────────────────────────────────────────────

// Bu tablo migration olarak ayrıca eklenmeli — index.ts'e ekleyeceğiz.
// today_tasks: user_id + task_date UNIQUE, JSON payload

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS today_tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      task_date DATE NOT NULL,
      task_type VARCHAR(30) NOT NULL,
      payload JSONB NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      completed_at TIMESTAMPTZ,
      skipped BOOLEAN NOT NULL DEFAULT FALSE,
      skipped_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, task_date)
    )
  `);
}
// Server boot'ta bir kez çalışır — hata sessizce geç
ensureTable().catch((e) => console.warn("[today-task] ensureTable warn:", e?.message));

// ─── GET /student/today-task ───────────────────────────────────────────────

router.get("/student/today-task", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });
    const date = todayIsoDate();

    // Cache kontrol — bugünkü görev zaten var mı?
    const existing = await pool.query(
      `SELECT id, task_type, payload, completed, skipped
       FROM today_tasks WHERE user_id = $1 AND task_date = $2 LIMIT 1`,
      [req.userId, date],
    );
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      // Eğer skipped ise yeni görev üret (aşağıda)
      if (!row.skipped) {
        return res.json({
          ok: true,
          task: row.payload as TodayTask,
          taskId: row.id,
          completed: row.completed,
        });
      }
    }

    // Yeni görev üret — user profile'ı çek
    const userRow = await pool.query(
      `SELECT current_level, sector, learning_goal FROM users WHERE id = $1 LIMIT 1`,
      [req.userId],
    );
    const u = userRow.rows[0];

    const level = (await getUserLevel(req.userId)) ?? (u?.current_level as any) ?? "B1";
    const sector = u?.sector ?? null;
    const goal = u?.learning_goal ?? null;

    const task = pickTaskForUser({
      userId: req.userId,
      level,
      sector,
      goal,
      date,
    });

    // DB'ye kaydet (UPSERT — skipped varsa günce)
    const upsert = await pool.query(
      `INSERT INTO today_tasks (user_id, task_date, task_type, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, task_date) DO UPDATE
         SET task_type = EXCLUDED.task_type,
             payload = EXCLUDED.payload,
             skipped = FALSE,
             skipped_at = NULL,
             completed = FALSE,
             completed_at = NULL
       RETURNING id, completed`,
      [req.userId, date, task.type, task],
    );

    return res.json({
      ok: true,
      task,
      taskId: upsert.rows[0]?.id,
      completed: upsert.rows[0]?.completed ?? false,
    });
  } catch (e: any) {
    console.error("[student/today-task GET] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── POST /student/today-task/skip ─────────────────────────────────────────

router.post("/student/today-task/skip", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });
    const date = todayIsoDate();
    await pool.query(
      `UPDATE today_tasks SET skipped = TRUE, skipped_at = NOW()
       WHERE user_id = $1 AND task_date = $2`,
      [req.userId, date],
    );
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[student/today-task/skip] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── POST /student/today-task/complete ─────────────────────────────────────

router.post("/student/today-task/complete", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Yetkisiz" });
    const date = todayIsoDate();
    await pool.query(
      `UPDATE today_tasks SET completed = TRUE, completed_at = NOW()
       WHERE user_id = $1 AND task_date = $2`,
      [req.userId, date],
    );
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[student/today-task/complete] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

export default router;
