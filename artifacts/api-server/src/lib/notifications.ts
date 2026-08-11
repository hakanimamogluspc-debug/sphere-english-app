import { db } from "@workspace/db";
import {
  notificationsTable,
  notificationPreferencesTable,
  usersTable,
  type Notification,
  type NotificationPreference,
} from "@workspace/db/schema";
import { and, eq, sql, desc, lt, gte, isNull } from "drizzle-orm";
import { sendEmail } from "./email.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationKind =
  | "streak_risk"
  | "inactivity_3d"
  | "inactivity_7d"
  | "new_assessment"
  | "level_up"
  | "new_quiz"
  | "weekly_digest"
  | "welcome"
  | "achievement";

export interface CreateNotificationInput {
  userId: number;
  kind: NotificationKind;
  title: string;
  body: string;
  actionUrl?: string;
  iconKind?: string;
  priority?: "low" | "normal" | "high";
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
  sendEmail?: boolean;
  emailSubject?: string;
  emailHtml?: string;
}

// ── Preferences helpers ──────────────────────────────────────────────────────

export async function ensurePreferences(userId: number): Promise<NotificationPreference> {
  const existing = await db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(notificationPreferencesTable)
    .values({ userId })
    .onConflictDoNothing({ target: notificationPreferencesTable.userId })
    .returning();
  if (created) return created;

  // race fallback
  const [again] = await db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId))
    .limit(1);
  return again;
}

const KIND_TO_EMAIL_PREF: Record<string, keyof NotificationPreference> = {
  streak_risk: "streakRiskEmail",
  inactivity_3d: "inactivityEmail",
  inactivity_7d: "inactivityEmail",
  new_assessment: "newAssessmentEmail",
  level_up: "levelUpEmail",
  new_quiz: "newQuizEmail",
  weekly_digest: "weeklyDigestEmail",
};

function shouldEmailForKind(prefs: NotificationPreference, kind: NotificationKind): boolean {
  if (!prefs.emailEnabled) return false;
  const prefKey = KIND_TO_EMAIL_PREF[kind];
  if (!prefKey) return true;
  return Boolean(prefs[prefKey]);
}

// ── Email template ───────────────────────────────────────────────────────────

function defaultEmailHtml({
  title,
  body,
  actionUrl,
  ctaLabel = "Hemen Aç",
  firstName,
}: {
  title: string;
  body: string;
  actionUrl?: string;
  ctaLabel?: string;
  firstName?: string;
}): string {
  const greeting = firstName ? `Merhaba ${firstName},` : "Merhaba,";
  const cta = actionUrl
    ? `<tr><td align="center" style="padding:24px 32px 8px 32px;">
         <a href="${actionUrl}" style="display:inline-block;background:#0f2d6b;color:#ffffff;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none;">${ctaLabel}</a>
       </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 0;">
<tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04);">
    <tr><td style="background:#ffffff;padding:14px 24px;text-align:center;border-bottom:1px solid #e2e8f0;">
      <img src="https://app.sphereenglish.com/images/logo-full.png" alt="Sphere English" width="120" style="display:block;margin:0 auto;max-width:120px;"/>
    </td></tr>
    <tr><td style="background:#0f2d6b;padding:32px 32px 28px;text-align:center;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#17aed8;letter-spacing:3px;text-transform:uppercase;">Sphere English</p>
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;line-height:1.3;">${title}</h1>
    </td></tr>
    <tr><td style="padding:28px 32px 8px;">
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">${greeting}</p>
      <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">${body.replace(/\n/g, "<br/>")}</p>
    </td></tr>
    ${cta}
    <tr><td style="padding:24px 32px 28px;color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;">
      Bu bildirimi almak istemiyorsanız <a href="https://app.sphereenglish.com/student/settings" style="color:#94a3b8;text-decoration:underline;">bildirim tercihlerinizi</a> güncelleyebilirsiniz.
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ── Core: createNotification ────────────────────────────────────────────────

export async function createNotification(input: CreateNotificationInput): Promise<Notification | null> {
  try {
    const prefs = await ensurePreferences(input.userId);

    if (!prefs.inAppEnabled) return null;

    // Dedupe — if a notification with the same dedupeKey exists in last 24h, skip.
    if (input.dedupeKey) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await db
        .select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.userId, input.userId),
            eq(notificationsTable.dedupeKey, input.dedupeKey),
            gte(notificationsTable.createdAt, yesterday),
          ),
        )
        .limit(1);
      if (existing[0]) return null;
    }

    const [inserted] = await db
      .insert(notificationsTable)
      .values({
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ?? null,
        iconKind: input.iconKind ?? "bell",
        priority: input.priority ?? "normal",
        metadata: input.metadata ?? {},
        dedupeKey: input.dedupeKey ?? null,
      })
      .returning();

    // Email channel ────
    if (input.sendEmail !== false && shouldEmailForKind(prefs, input.kind)) {
      const [user] = await db
        .select({ email: usersTable.email, firstName: usersTable.firstName })
        .from(usersTable)
        .where(eq(usersTable.id, input.userId))
        .limit(1);
      if (user?.email) {
        const subject = input.emailSubject ?? input.title;
        const html =
          input.emailHtml ??
          defaultEmailHtml({
            title: input.title,
            body: input.body,
            actionUrl: input.actionUrl,
            firstName: user.firstName,
          });
        try {
          const result = await sendEmail(user.email, subject, html);
          if (result.ok) {
            await db
              .update(notificationsTable)
              .set({ emailedAt: new Date() })
              .where(eq(notificationsTable.id, inserted.id));
            await db
              .update(notificationPreferencesTable)
              .set({ lastEmailSentAt: new Date(), updatedAt: new Date() })
              .where(eq(notificationPreferencesTable.userId, input.userId));
          } else {
            console.warn("Notification email failed:", result.error);
          }
        } catch (e: any) {
          console.warn("Notification email exception:", e?.message);
        }
      }
    }

    return inserted;
  } catch (err: any) {
    console.error("createNotification error:", err?.message || err);
    return null;
  }
}

// ── Triggers ─────────────────────────────────────────────────────────────────

export async function notifyNewAssessment(
  userId: number,
  payload: { cefr: string; assessmentId: number; teacherName: string; aiSummary?: string },
) {
  return createNotification({
    userId,
    kind: "new_assessment",
    title: `Yeni CEFR raporu hazır: ${payload.cefr}`,
    body:
      payload.aiSummary && payload.aiSummary.length > 0
        ? `${payload.teacherName} ile yaptığın seansın değerlendirmesi hazır. ${payload.aiSummary}`
        : `${payload.teacherName} ile yaptığın seansın detaylı CEFR raporu hazır. Güçlü yönlerini ve geliştirmen gereken alanları görmek için raporu aç.`,
    actionUrl: `https://app.sphereenglish.com/student/pronunciation-coach?assessment=${payload.assessmentId}`,
    iconKind: "award",
    priority: "normal",
    metadata: { assessmentId: payload.assessmentId, cefr: payload.cefr },
    dedupeKey: `assessment-${payload.assessmentId}`,
  });
}

export async function notifyLevelUp(
  userId: number,
  payload: { fromLevel: string | null; toLevel: string },
) {
  return createNotification({
    userId,
    kind: "level_up",
    title: `Seviye atladın: ${payload.toLevel}!`,
    body: payload.fromLevel
      ? `Tebrikler! Sphere AI, seviyeni ${payload.fromLevel}'den ${payload.toLevel}'ye yükseltti. İlerlemen harika gidiyor — bu seviyeye uygun yeni alıştırmaları denemek için panele gel.`
      : `Tebrikler! Sphere AI seviyeni ${payload.toLevel} olarak belirledi. Bu seviyene özel pratikler için panele gel.`,
    actionUrl: "https://app.sphereenglish.com/student",
    iconKind: "trending-up",
    priority: "high",
    metadata: { fromLevel: payload.fromLevel, toLevel: payload.toLevel },
    dedupeKey: `level-${payload.toLevel}`,
  });
}

export async function notifyStreakRisk(userId: number, currentStreak: number) {
  return createNotification({
    userId,
    kind: "streak_risk",
    title: `${currentStreak} günlük serini kaybetmek üzeresin`,
    body: `Bugün hâlâ aktif değilsin. ${currentStreak} günlük serini koruman için sadece kısa bir AI seansı yapman yeterli — 5 dakika ayır, seri bozulmasın!`,
    actionUrl: "https://app.sphereenglish.com/student/pronunciation-coach",
    iconKind: "flame",
    priority: "high",
    metadata: { streak: currentStreak },
    dedupeKey: `streak-risk-${new Date().toISOString().slice(0, 10)}`,
  });
}

export async function notifyInactivity(userId: number, daysInactive: number) {
  const kind: NotificationKind = daysInactive >= 7 ? "inactivity_7d" : "inactivity_3d";
  const title = daysInactive >= 7 ? "Seni özledik!" : "Birkaç gün oldu — devam edelim mi?";
  const body =
    daysInactive >= 7
      ? `${daysInactive} gündür seni Sphere English'de görmedik. Birkaç dakikalık bir AI seansı bile büyük fark yaratıyor. Telaffuz koçun seni bekliyor.`
      : `Son ${daysInactive} gündür pratik yapmadın. Kısa bir oturumla geri dönmeye ne dersin?`;
  return createNotification({
    userId,
    kind,
    title,
    body,
    actionUrl: "https://app.sphereenglish.com/student/pronunciation-coach",
    iconKind: "calendar",
    priority: "normal",
    metadata: { daysInactive },
    dedupeKey: `inactivity-${daysInactive >= 7 ? "7d" : "3d"}-${new Date().toISOString().slice(0, 10)}`,
  });
}

// ── Daily checker — runs once per day, scans all students ─────────────────

let lastCheckerRun: number = 0;
const ONE_HOUR = 60 * 60 * 1000;

export async function runDailyNotificationChecker(force = false): Promise<{ scanned: number; notified: number }> {
  const now = Date.now();
  if (!force && now - lastCheckerRun < 6 * ONE_HOUR) {
    return { scanned: 0, notified: 0 };
  }
  lastCheckerRun = now;

  let scanned = 0;
  let notified = 0;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const students = await db
      .select({
        id: usersTable.id,
        streak: usersTable.streak,
        lastActiveDate: usersTable.lastActiveDate,
      })
      .from(usersTable)
      .where(eq(usersTable.role, "student"));

    for (const s of students) {
      scanned++;
      if (!s.lastActiveDate) continue;
      if (s.lastActiveDate === today) continue;

      const last = new Date(s.lastActiveDate + "T00:00:00Z");
      const cur = new Date(today + "T00:00:00Z");
      const daysDiff = Math.round((cur.getTime() - last.getTime()) / 86400000);

      // Streak risk: had a streak >=3, hasn't been active today
      if (s.streak >= 3 && daysDiff === 1) {
        const created = await notifyStreakRisk(s.id, s.streak);
        if (created) notified++;
      }

      // Inactivity reminders
      if (daysDiff === 3) {
        const created = await notifyInactivity(s.id, 3);
        if (created) notified++;
      } else if (daysDiff === 7) {
        const created = await notifyInactivity(s.id, 7);
        if (created) notified++;
      }
    }
  } catch (err: any) {
    console.error("Daily notification checker error:", err?.message || err);
  }

  return { scanned, notified };
}

// ── Read helpers used by routes ──────────────────────────────────────────────

export async function listNotifications(userId: number, limit = 30) {
  return db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);
}

export async function unreadCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt)));
  return row?.c ?? 0;
}

export async function markAllRead(userId: number): Promise<void> {
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt)));
}

export async function markRead(userId: number, id: number): Promise<boolean> {
  const result = await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)))
    .returning({ id: notificationsTable.id });
  return result.length > 0;
}

export async function deleteNotification(userId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)))
    .returning({ id: notificationsTable.id });
  return result.length > 0;
}
