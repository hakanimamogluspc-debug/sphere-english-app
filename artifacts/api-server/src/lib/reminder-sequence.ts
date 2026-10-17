/**
 * Geri dönüş (comeback) hatırlatma dizisi — 3 / 7 / 14 / 30 / 60. gün.
 *
 * Eski davranış: 2–14 gün inaktif herkese aynı mail, 6 günde bir.
 * Yeni davranış:
 *   - İnaktif gün sayısına (D) göre dizideki EN SON hak edilen dokunuş seçilir
 *     (D=9 → 7. gün dokunuşu). Aynı dokunuş, kullanıcının son aktif tarihinden
 *     sonra bir kez gönderilmişse tekrar gönderilmez → her inaktiflik döneminde
 *     her dokunuş en fazla 1 kez.
 *   - Kullanıcı geri dönüp tekrar kaybolursa dizi baştan başlar (log'lar
 *     last_active_date'ten eski olduğu için sayılmaz).
 *   - 60. gün "son mesaj"; sonrasında dokunuş yok.
 *   - Her dokunuşta 2 konu satırı varyantı (A/B) — kullanıcı id'sine göre
 *     deterministik, notification_log.variant'a yazılır. Geri dönüş oranı
 *     admin ekranında varyant bazında görünür.
 *
 * Kişiselleştirme: seviye, öğrenme hedefi, sektör, tekrar bekleyen kelime sayısı,
 * son 30 günde en çok kullanılan modül.
 */
import { pool } from "@workspace/db";

export interface ReminderTouch {
  /** notification_log.type */
  key: string;
  /** inaktif gün eşiği */
  day: number;
  /** dokunuş adı (admin ekranı) */
  label: string;
}

export const COMEBACK_TOUCHES: ReminderTouch[] = [
  { key: "comeback_3", day: 3, label: "3. gün — kısa mola" },
  { key: "comeback_7", day: 7, label: "7. gün — kelimeler unutulmadan" },
  { key: "comeback_14", day: 14, label: "14. gün — yeni bir açı" },
  { key: "comeback_30", day: 30, label: "30. gün — hedefin hâlâ geçerli mi?" },
  { key: "comeback_60", day: 60, label: "60. gün — son mesaj" },
];

/** Dizi dışına çıkmış (çok eski) kullanıcıya dokunma */
export const MAX_INACTIVE_DAYS = 75;

/** D gün inaktif kullanıcı için hak edilen dokunuş (yoksa null) */
export function pickTouch(inactiveDays: number): ReminderTouch | null {
  if (inactiveDays > MAX_INACTIVE_DAYS) return null;
  let chosen: ReminderTouch | null = null;
  for (const t of COMEBACK_TOUCHES) if (inactiveDays >= t.day) chosen = t;
  return chosen;
}

export type Variant = "A" | "B";
export function pickVariant(userId: number): Variant {
  return userId % 2 === 0 ? "A" : "B";
}

export interface ReminderUser {
  id: number;
  firstName: string;
  email: string;
  inactiveDays: number;
  level: string | null;
  learningGoal: string | null;
  sector: string | null;
  dueVocab: number;
  topModule: string | null;
  totalMinutes30: number;
}

const GOAL_LABEL: Record<string, string> = {
  interview: "iş görüşmelerine hazırlanmak",
  meetings: "toplantılarda daha etkili olmak",
  presentation: "sunum yapmak",
  email: "iş e-postalarını iyi yazmak",
  customer: "uluslararası müşterilerle iletişim",
  certificate: "CEFR sertifikası almak",
  general: "genel akıcılık kazanmak",
};

const MODULE_LABEL: Record<string, { label: string; path: string }> = {
  // user_daily_activity.module değerleri — bkz. lib/activity-module.ts
  pronunciation_coach: { label: "Konuşma Koçu", path: "/student/pronunciation-coach" },
  speaking_scenes: { label: "Konuşma Sahneleri", path: "/student/speaking-scenes" },
  writing_coach: { label: "Yazma Koçu", path: "/student/writing-coach" },
  grammar_coach: { label: "Dilbilgisi Koçu", path: "/student/grammar-coach" },
  vocab_game: { label: "Kelime Oyunu", path: "/student/vocab-game" },
  vocab_hub: { label: "Kelime Tekrarı", path: "/student/vocab-hub" },
  simulation_mode: { label: "İş Senaryoları", path: "/student/simulation-mode" },
  interview_sim: { label: "Mülakat Simülatörü", path: "/student/interview-sim" },
  presentation_sim: { label: "Sunum Simülatörü", path: "/student/presentation-sim" },
  ai_quiz: { label: "Akıllı Quiz", path: "/student/ai-quiz" },
  ai_tutor: { label: "Kişisel AI Öğretmen", path: "/student/ai-tutor" },
  business_cards: { label: "İş Kartları", path: "/is-kartlari" },
  learning_path: { label: "Öğrenme Yolu", path: "/student/learning-path" },
  level_exams: { label: "Seviye Sınavları", path: "/student/level-exams" },
  student_speaking_club: { label: "Speaking Club", path: "/student/speaking-club" },
  student_materials: { label: "Materyallerim", path: "/student/materials" },
  discover: { label: "Keşfet", path: "/kesfet" },
  career: { label: "İzle & Dinle", path: "/kariyer" },
  watch_listen: { label: "İzle & Dinle", path: "/kariyer" },
};

function moduleInfo(key: string | null) {
  if (!key || key === "general") return null;
  return MODULE_LABEL[key] ?? null;
}

/** Aday kullanıcılar + kişiselleştirme verisi (tek sorgu, N+1 yok) */
export async function loadCandidates(minInactive = 3): Promise<ReminderUser[]> {
  const { rows } = await pool.query(
    `WITH base AS (
       SELECT u.id, u.first_name, u.email, u.current_level, u.learning_goal, u.sector,
              (CURRENT_DATE - u.last_active_date::date)::int AS inactive_days
         FROM users u
         LEFT JOIN notification_preferences p ON p.user_id = u.id
        WHERE u.role = 'student'
          AND u.email IS NOT NULL AND u.email <> ''
          AND u.email NOT LIKE '%@staging.invalid'
          AND u.last_active_date IS NOT NULL
          AND (CURRENT_DATE - u.last_active_date::date) BETWEEN $1 AND $2
          AND COALESCE(p.inactivity_email, TRUE) = TRUE
     ),
     vocab AS (
       SELECT user_id, COUNT(*)::int AS due
         FROM user_vocab_progress
        WHERE is_learned = false AND next_review_at IS NOT NULL AND next_review_at <= NOW()
        GROUP BY user_id
     ),
     act AS (
       SELECT user_id, module, SUM(minutes)::int AS minutes
         FROM user_daily_activity
        WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY user_id, module
     ),
     top_mod AS (
       SELECT DISTINCT ON (user_id) user_id, module, minutes
         FROM act ORDER BY user_id, minutes DESC
     ),
     total AS (
       SELECT user_id, SUM(minutes)::int AS minutes FROM act GROUP BY user_id
     )
     SELECT b.*, COALESCE(v.due, 0) AS due_vocab, tm.module AS top_module, COALESCE(t.minutes, 0) AS total_minutes
       FROM base b
       LEFT JOIN vocab v ON v.user_id = b.id
       LEFT JOIN top_mod tm ON tm.user_id = b.id
       LEFT JOIN total t ON t.user_id = b.id
      ORDER BY b.id
      LIMIT 5000`,
    [minInactive, MAX_INACTIVE_DAYS],
  );
  return rows.map((r: any) => ({
    id: r.id,
    firstName: String(r.first_name || "").trim().split(" ")[0] || "Merhaba",
    email: r.email,
    inactiveDays: r.inactive_days,
    level: r.current_level ?? null,
    learningGoal: r.learning_goal ?? null,
    sector: r.sector ?? null,
    dueVocab: r.due_vocab ?? 0,
    topModule: r.top_module ?? null,
    totalMinutes30: r.total_minutes ?? 0,
  }));
}

/** Bu inaktiflik döneminde (son aktif tarihten sonra) bu dokunuş gönderilmiş mi? */
export async function alreadySentThisPeriod(userId: number, touchKey: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM notification_log nl
       JOIN users u ON u.id = nl.user_id
      WHERE nl.user_id = $1 AND nl.type = $2 AND nl.channel = 'email'
        AND nl.sent_date > u.last_active_date::date
      LIMIT 1`,
    [userId, touchKey],
  );
  return rows.length > 0;
}

/** Son 2 günde herhangi bir comeback dokunuşu gitmiş mi? (üst üste mail önleme) */
export async function sentRecently(userId: number, days = 2): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM notification_log
      WHERE user_id = $1 AND type LIKE 'comeback%' AND channel = 'email'
        AND sent_date >= CURRENT_DATE - ($2::int) LIMIT 1`,
    [userId, days],
  );
  return rows.length > 0;
}

// ─── Şablonlar ───────────────────────────────────────────────────────────────

export interface RenderedMail {
  subject: string;
  html: string;
  pushTitle: string;
  pushBody: string;
  ctaPath: string;
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function layout(opts: { title: string; emoji: string; accent: string; paragraphs: string[]; bullets?: string[]; cta: string; ctaUrl: string; footerNote?: string; appUrl: string }): string {
  const { title, emoji, accent, paragraphs, bullets, cta, ctaUrl, footerNote, appUrl } = opts;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f3f6fb;margin:0;padding:20px;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;box-shadow:0 2px 8px rgba(27,54,93,.06);">
    <tr><td>
      <div style="font-size:40px;margin-bottom:6px;">${emoji}</div>
      <h1 style="color:${accent};font-size:22px;margin:0 0 14px 0;line-height:1.3;">${esc(title)}</h1>
      ${paragraphs.map((p) => `<p style="color:#334155;font-size:15px;line-height:1.65;margin:12px 0;">${p}</p>`).join("")}
      ${bullets && bullets.length ? `<ul style="color:#475569;font-size:14px;line-height:1.7;margin:14px 0;padding-left:20px;">${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}
      <div style="margin:26px 0;text-align:center;">
        <a href="${ctaUrl}" style="display:inline-block;background:#1e3a6e;color:#fff;padding:14px 30px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">${esc(cta)} →</a>
      </div>
      ${footerNote ? `<p style="color:#64748b;font-size:13px;line-height:1.5;margin:0 0 12px 0;">${footerNote}</p>` : ""}
      <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:20px 0 0 0;border-top:1px solid #e2e8f0;padding-top:14px;">
        Bu hatırlatmaları <a href="${appUrl}/ayarlar/bildirimler" style="color:#64748b;">bildirim tercihlerinden</a> kapatabilirsin.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

export function renderComeback(touch: ReminderTouch, u: ReminderUser, variant: Variant, appUrl: string): RenderedMail {
  const name = esc(u.firstName);
  const goal = u.learningGoal ? GOAL_LABEL[u.learningGoal] ?? null : null;
  const top = moduleInfo(u.topModule);
  const level = u.level ?? null;

  switch (touch.key) {
    case "comeback_3": {
      const subject = variant === "A"
        ? `${u.firstName}, 2 dakikan var mı?`
        : `${u.firstName}, kaldığın yer seni bekliyor`;
      const ctaPath = top?.path ?? "/dashboard";
      return {
        subject, ctaPath,
        pushTitle: "2 dakikan var mı?",
        pushBody: top ? `${top.label}'nda kaldığın yerden devam et.` : "Bugün için kısa bir görev hazır.",
        html: layout({
          appUrl, emoji: "☕", accent: "#1e3a6e", title: "Kısa bir mola, sorun değil",
          paragraphs: [
            `Merhaba <strong>${name}</strong>, üç gündür görüşmedik. Uzun oturum gerekmez — bugün <strong>2 dakika</strong> yeter.`,
            top
              ? `En çok kullandığın modül <strong>${esc(top.label)}</strong>; tam kaldığın yerden açılıyor.`
              : `Kontrol panelinde bugün için tek bir küçük görev var.`,
          ],
          cta: top ? `${top.label}'na dön` : "Bugünkü görevi aç",
          ctaUrl: `${appUrl}${ctaPath}?utm_source=reminder&utm_campaign=${touch.key}&v=${variant}`,
        }),
      };
    }
    case "comeback_7": {
      const due = u.dueVocab;
      const subject = variant === "A"
        ? (due > 0 ? `${due} kelime unutulmak üzere` : `${u.firstName}, bir hafta oldu`)
        : `${u.firstName}, bu hafta 10 dakika yeter`;
      const ctaPath = due > 0 ? "/student/vocab-hub" : "/student/vocab-game";
      return {
        subject, ctaPath,
        pushTitle: due > 0 ? `${due} kelime tekrar bekliyor` : "Bir hafta oldu",
        pushBody: "5 dakikalık tekrarla hepsini geri kazan.",
        html: layout({
          appUrl, emoji: "🧠", accent: "#0e7da6", title: due > 0 ? `${due} kelime tekrar bekliyor` : "Bir hafta oldu",
          paragraphs: [
            `Merhaba <strong>${name}</strong>. Öğrenilen kelimeler bir hafta tekrar edilmeyince hızla silikleşir; ${due > 0 ? `şu an <strong>${due} kelimen</strong> tam o eşikte.` : "haftalık kısa bir tekrar bunu önler."}`,
            `Kelime Tekrarı önce unutmak üzere olduklarını getirir; <strong>5 dakika</strong> çoğunu geri kazandırır.${level ? ` ${esc(level)} seviyesindeki kelime setin de hazır.` : ""}`,
          ],
          cta: due > 0 ? "Kelimeleri tekrar et" : "Kelime turuna başla",
          ctaUrl: `${appUrl}${ctaPath}?utm_source=reminder&utm_campaign=${touch.key}&v=${variant}`,
        }),
      };
    }
    case "comeback_14": {
      const subject = variant === "A"
        ? `${u.firstName}, bugün farklı bir şey dene`
        : `Yabancı bir müşteriyle 3 dakikalık görüşme (prova)`;
      const ctaPath = "/student/speaking-scenes";
      return {
        subject, ctaPath,
        pushTitle: "Bugün farklı bir şey dene",
        pushBody: "3 dakikalık bir konuşma sahnesi — gerçek bir iş görüşmesi gibi.",
        html: layout({
          appUrl, emoji: "🎭", accent: "#1e3a6e", title: "Aynı şeyi tekrar etmek yerine",
          paragraphs: [
            `Merhaba <strong>${name}</strong>. İki haftadır ara verdiysen sebep çoğu zaman sıkılmaktır, zaman değil. O yüzden bu kez ders değil, <strong>bir sahne</strong> öneriyoruz:`,
          ],
          bullets: [
            `<strong>Konuşma Sahneleri:</strong> ${goal === "customer" || goal === "meetings" ? "yabancı müşteriyle fiyat görüşmesi" : goal === "interview" ? "İngilizce mülakatın ilk 3 dakikası" : goal === "presentation" ? "sunum sonrası zor soru" : "telefonla randevu alma"} — AI koçla, 3–4 dakika, puanlı.`,
            `Bitince ne kadar akıcı olduğunu ve hangi kelimelerde takıldığını görürsün.`,
          ],
          cta: "Bir sahne seç",
          ctaUrl: `${appUrl}${ctaPath}?utm_source=reminder&utm_campaign=${touch.key}&v=${variant}`,
        }),
      };
    }
    case "comeback_30": {
      const subject = variant === "A"
        ? `${u.firstName}, hedefin hâlâ geçerli mi?`
        : `Bir ay oldu — tek bir soru`;
      const ctaPath = "/dashboard";
      const goalLine = goal ? `Başlarken hedefin <strong>${esc(goal)}</strong> idi.` : `Başlarken bir hedefin vardı.`;
      return {
        subject, ctaPath,
        pushTitle: "Hedefin hâlâ geçerli mi?",
        pushBody: "Bir ay oldu. Geri dönmek için tek bir adım yeter.",
        html: layout({
          appUrl, emoji: "🎯", accent: "#0e7da6", title: "Bir ay oldu",
          paragraphs: [
            `Merhaba <strong>${name}</strong>. ${goalLine} O hedef hâlâ geçerliyse, geri dönmek için büyük bir karar gerekmiyor: <strong>bu hafta iki kez 10 dakika</strong>.`,
            `Geçerli değilse ya da bir şey seni durdurduysa, tek cümleyle yazmanı isteriz — programı ona göre ayarlarız. Bu e-postaya cevap vermen yeterli.`,
          ],
          cta: "Kaldığım yerden devam",
          ctaUrl: `${appUrl}${ctaPath}?utm_source=reminder&utm_campaign=${touch.key}&v=${variant}`,
          footerNote: `Hesabın ve ilerlemen olduğu gibi duruyor; hiçbir şey silinmedi.`,
        }),
      };
    }
    default: {
      // comeback_60 — son mesaj
      const subject = variant === "A"
        ? `${u.firstName}, bu son hatırlatmamız`
        : `Rahatsız etmeyi bırakıyoruz — kapı açık`;
      const ctaPath = "/dashboard";
      return {
        subject, ctaPath,
        pushTitle: "Son hatırlatma",
        pushBody: "Bundan sonra yazmayacağız; istediğinde kaldığın yer burada.",
        html: layout({
          appUrl, emoji: "🚪", accent: "#1e3a6e", title: "Bu son hatırlatmamız",
          paragraphs: [
            `Merhaba <strong>${name}</strong>. İki aydır uğramadın; bundan sonra hatırlatma göndermeyeceğiz — gelen kutunu meşgul etmek istemiyoruz.`,
            `Hesabın, seviyen${level ? ` (${esc(level)})` : ""} ve kelimelerin duruyor. Ne zaman istersen tek tıkla kaldığın yerden devam edersin. Bir şey ters gittiyse ve söylemek istersen, bu e-postaya cevap yaz; okuyoruz.`,
          ],
          cta: "Hesabıma dön",
          ctaUrl: `${appUrl}${ctaPath}?utm_source=reminder&utm_campaign=${touch.key}&v=${variant}`,
        }),
      };
    }
  }
}

/** Streak-risk için 3 ton (haftanın gününe göre döner) */
export function renderStreakRisk(firstName: string, streak: number, appUrl: string, dayOfWeek = new Date().getDay()): RenderedMail & { variant: Variant | "C" } {
  const name = esc(firstName);
  const idx = dayOfWeek % 3;
  const variant = (["A", "B", "C"] as const)[idx];
  const common = { ctaPath: "/dashboard", pushBody: `${firstName}, 2 dakika ayır — serini koru.` };
  if (idx === 0) {
    return {
      ...common, variant,
      subject: `${firstName}, ${streak} günlük serin bu gece sıfırlanır`,
      pushTitle: `${streak} günlük seri risk altında`,
      html: layout({
        appUrl, emoji: "🔥", accent: "#ea580c", title: `${streak} günlük serin tehlikede`,
        paragraphs: [`Merhaba <strong>${name}</strong>, bugün henüz çalışmadın. Gece yarısından önce 2 dakikalık tek bir aktivite seriyi korur.`],
        cta: "Serimi koru", ctaUrl: `${appUrl}/dashboard?utm_source=reminder&utm_campaign=streak_risk&v=${variant}`,
      }),
    };
  }
  if (idx === 1) {
    return {
      ...common, variant,
      subject: `${streak} gün üst üste — bugünü de ekle`,
      pushTitle: `${streak} gün üst üste`,
      html: layout({
        appUrl, emoji: "📈", accent: "#0e7da6", title: `${streak} gün üst üste çalıştın`,
        paragraphs: [`Merhaba <strong>${name}</strong>. Düzenlilik, seviye atlatan tek şey; bugün de kısa bir kelime turu ya da bir konuşma kaydı yeterli.`],
        cta: "Bugünü tamamla", ctaUrl: `${appUrl}/dashboard?utm_source=reminder&utm_campaign=streak_risk&v=${variant}`,
      }),
    };
  }
  return {
    ...common, variant,
    subject: `${firstName}, bugünlük 1 iş kartı`,
    pushTitle: "Bugünlük 1 iş kartı",
    html: layout({
      appUrl, emoji: "🃏", accent: "#1e3a6e", title: "Bugünlük tek bir iş kartı",
      paragraphs: [`Merhaba <strong>${name}</strong>. ${streak} günlük serini sürdürmek için bugün bir iş kartı oku, bir cümleyi sesli söyle — bitti.`],
      cta: "İş kartını aç", ctaUrl: `${appUrl}/is-kartlari?utm_source=reminder&utm_campaign=streak_risk&v=${variant}`,
    }),
  };
}
