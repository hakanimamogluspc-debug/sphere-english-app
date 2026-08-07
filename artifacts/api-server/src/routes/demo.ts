/**
 * Demo Randevu Sistemi
 *
 * PUBLIC endpoints (auth yok — www'den erişilebilir):
 *   GET  /api/demo/availability?month=YYYY-MM   → ayın günlerine göre durum (available/blocked/full)
 *   GET  /api/demo/slots?date=YYYY-MM-DD        → belirli günün slot listesi (available/booked)
 *   POST /api/demo/book                          → rezervasyon oluştur
 *
 * ADMIN endpoints (auth: admin):
 *   GET    /admin/demo/bookings                 → tüm rezervasyonlar (filter)
 *   PATCH  /admin/demo/bookings/:id             → status/notes/meeting_link güncelle
 *   DELETE /admin/demo/bookings/:id             → iptal (soft: status=cancelled)
 *   GET    /admin/demo/availability             → haftalık mesai saatleri
 *   PUT    /admin/demo/availability             → toplu güncelle
 *   GET    /admin/demo/blocks                   → engelli tarihler
 *   POST   /admin/demo/blocks                   → engel ekle
 *   DELETE /admin/demo/blocks/:id               → engel sil
 */

import { Router, Request, Response } from "express";
import { sql, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/auth.js";
import { sendEmail } from "../lib/email.js";
import { notifyAll } from "../lib/admin-notifications.js";

const router = Router();

const SLOT_MINUTES = 30;
const MIN_ADVANCE_HOURS = 24;
const MAX_ADVANCE_DAYS = 60;

// ─── Helpers ──────────────────────────────────────────────────────────
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function dowFromDate(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.getUTCDay(); // 0=Pzr .. 6=Cts
}
function hoursFromNow(dateStr: string, timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  const target = new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+03:00`);
  return (target.getTime() - Date.now()) / 3600_000;
}

async function requireAdmin(req: Request, res: Response, next: () => void) {
  const userId = (req as any).userId as number;
  const [me] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!me || me.role !== "admin") return res.status(403).json({ error: "Admin yetkisi gerekli" });
  next();
}

// ─── PUBLIC — availability by month ───────────────────────────────────
// Response: { days: { "2026-08-10": "available" | "blocked" | "full", ... } }
router.get("/demo/availability", async (req: Request, res: Response) => {
  try {
    const monthParam = String(req.query?.month ?? "").trim(); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(monthParam)) {
      return res.status(400).json({ error: "month YYYY-MM formatında olmalı" });
    }
    const [yr, mo] = monthParam.split("-").map(Number);
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const monthStart = `${monthParam}-01`;
    const monthEnd = `${monthParam}-${String(daysInMonth).padStart(2, "0")}`;

    // Haftalık mesai
    const availRows = await db.execute(sql`SELECT day_of_week, start_time, end_time, is_active FROM demo_availability`);
    const availByDow: Record<number, { start: string; end: string; active: boolean }> = {};
    for (const r of (availRows.rows ?? availRows) as any[]) {
      availByDow[Number(r.day_of_week)] = {
        start: String(r.start_time).slice(0, 5),
        end: String(r.end_time).slice(0, 5),
        active: !!r.is_active,
      };
    }

    // Tam gün engelli tarihler (start_time IS NULL)
    const blockRows = await db.execute(sql`
      SELECT block_date, start_time, end_time
      FROM demo_blocks
      WHERE block_date >= ${monthStart}::DATE AND block_date <= ${monthEnd}::DATE
    `);
    const fullDayBlocked = new Set<string>();
    for (const r of (blockRows.rows ?? blockRows) as any[]) {
      if (!r.start_time && !r.end_time) {
        fullDayBlocked.add(new Date(r.block_date).toISOString().slice(0, 10));
      }
    }

    // Aynı gün için toplam rezervasyon sayısı → "full" tespit için
    const bookRows = await db.execute(sql`
      SELECT booking_date::TEXT AS d, COUNT(*)::INT AS c
      FROM demo_bookings
      WHERE booking_date >= ${monthStart}::DATE AND booking_date <= ${monthEnd}::DATE
        AND status = 'confirmed'
      GROUP BY booking_date
    `);
    const bookedCount: Record<string, number> = {};
    for (const r of (bookRows.rows ?? bookRows) as any[]) {
      bookedCount[String(r.d)] = Number(r.c);
    }

    const days: Record<string, "available" | "blocked" | "full" | "past" | "closed"> = {};
    const today = todayIso();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthParam}-${String(d).padStart(2, "0")}`;
      if (dateStr < today) { days[dateStr] = "past"; continue; }
      if (fullDayBlocked.has(dateStr)) { days[dateStr] = "blocked"; continue; }
      const dow = dowFromDate(dateStr);
      const av = availByDow[dow];
      if (!av || !av.active) { days[dateStr] = "closed"; continue; }
      // Slot sayısını hesapla
      const totalSlots = Math.floor((toMinutes(av.end) - toMinutes(av.start)) / SLOT_MINUTES);
      const booked = bookedCount[dateStr] ?? 0;
      days[dateStr] = booked >= totalSlots ? "full" : "available";
    }

    return res.json({ days, month: monthParam });
  } catch (e: any) {
    console.error("[demo/availability] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── PUBLIC — slots for a specific date ───────────────────────────────
// Response: { slots: [{start:"09:00", end:"09:30", available: true}, ...] }
router.get("/demo/slots", async (req: Request, res: Response) => {
  try {
    const dateStr = String(req.query?.date ?? "").trim();
    if (!isValidDate(dateStr)) return res.status(400).json({ error: "date YYYY-MM-DD" });
    if (dateStr < todayIso()) return res.json({ slots: [], reason: "past" });

    const dow = dowFromDate(dateStr);
    const availRes = await db.execute(sql`
      SELECT start_time, end_time, is_active
      FROM demo_availability
      WHERE day_of_week = ${dow}
      LIMIT 1
    `);
    const av = ((availRes.rows ?? availRes) as any[])[0];
    if (!av || !av.is_active) return res.json({ slots: [], reason: "closed" });

    const startMin = toMinutes(String(av.start_time).slice(0, 5));
    const endMin = toMinutes(String(av.end_time).slice(0, 5));

    // Bugünkü blockları (part-day) çek
    const blockRes = await db.execute(sql`
      SELECT start_time, end_time
      FROM demo_blocks
      WHERE block_date = ${dateStr}::DATE
    `);
    const blocks: Array<{ start: number; end: number }> = [];
    for (const r of (blockRes.rows ?? blockRes) as any[]) {
      if (!r.start_time && !r.end_time) {
        return res.json({ slots: [], reason: "blocked" });
      }
      blocks.push({
        start: toMinutes(String(r.start_time).slice(0, 5)),
        end: toMinutes(String(r.end_time).slice(0, 5)),
      });
    }

    // Booked slots
    const bookRes = await db.execute(sql`
      SELECT start_time
      FROM demo_bookings
      WHERE booking_date = ${dateStr}::DATE AND status = 'confirmed'
    `);
    const bookedStarts = new Set(
      ((bookRes.rows ?? bookRes) as any[]).map((r) => String(r.start_time).slice(0, 5)),
    );

    const slots: Array<{ start: string; end: string; available: boolean; reason?: string }> = [];
    for (let m = startMin; m + SLOT_MINUTES <= endMin; m += SLOT_MINUTES) {
      const s = fromMinutes(m);
      const e = fromMinutes(m + SLOT_MINUTES);
      let available = true;
      let reason: string | undefined;
      if (bookedStarts.has(s)) { available = false; reason = "booked"; }
      else if (blocks.some((b) => m < b.end && m + SLOT_MINUTES > b.start)) {
        available = false; reason = "blocked";
      }
      else if (hoursFromNow(dateStr, s) < MIN_ADVANCE_HOURS) {
        available = false; reason = "too-soon";
      }
      slots.push({ start: s, end: e, available, ...(reason ? { reason } : {}) });
    }

    return res.json({ slots, date: dateStr, dayOfWeek: dow });
  } catch (e: any) {
    console.error("[demo/slots] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── PUBLIC — book ────────────────────────────────────────────────────
router.post("/demo/book", async (req: Request, res: Response) => {
  try {
    const {
      date, time, name, email, phone, company, message,
    } = (req.body ?? {}) as any;

    if (!isValidDate(String(date ?? ""))) return res.status(400).json({ error: "date geçersiz" });
    if (!/^\d{2}:\d{2}$/.test(String(time ?? ""))) return res.status(400).json({ error: "time geçersiz (HH:MM)" });
    const cleanName = String(name ?? "").trim();
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    if (!cleanName) return res.status(400).json({ error: "İsim gerekli" });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return res.status(400).json({ error: "E-posta geçersiz" });

    if (String(date) < todayIso()) return res.status(400).json({ error: "Geçmiş tarihe randevu alınamaz" });
    if (hoursFromNow(String(date), String(time)) < MIN_ADVANCE_HOURS) {
      return res.status(400).json({ error: `Randevu için en az ${MIN_ADVANCE_HOURS} saat öncesinden talep gerekiyor` });
    }

    // Slot müsait mi teyit
    const bookRes = await db.execute(sql`
      SELECT id FROM demo_bookings
      WHERE booking_date = ${date}::DATE
        AND start_time = ${time}::TIME
        AND status = 'confirmed'
      LIMIT 1
    `);
    if (((bookRes.rows ?? bookRes) as any[]).length > 0) {
      return res.status(409).json({ error: "Bu saat aralığı az önce dolduruldu. Lütfen başka bir saat seçin." });
    }

    // End time: SLOT_MINUTES sonrası
    const endMin = toMinutes(String(time)) + SLOT_MINUTES;
    const endTime = fromMinutes(endMin);

    const insertRes = await db.execute(sql`
      INSERT INTO demo_bookings (
        booking_date, start_time, end_time, duration_min,
        customer_name, customer_email, customer_phone, customer_company, message
      ) VALUES (
        ${date}::DATE, ${time}::TIME, ${endTime}::TIME, ${SLOT_MINUTES},
        ${cleanName}, ${cleanEmail},
        ${(phone && String(phone).trim()) || null},
        ${(company && String(company).trim()) || null},
        ${(message && String(message).trim()) || null}
      )
      RETURNING id
    `);
    const bookingId = Number(((insertRes.rows ?? insertRes) as any[])[0]?.id);

    // Mail bildirimleri — fire-and-forget
    sendBookingConfirmationEmails({
      bookingId, date: String(date), time: String(time), endTime,
      name: cleanName, email: cleanEmail, phone, company, message,
    }).catch((e) => console.warn("[demo] mail hata:", e?.message));

    return res.json({
      ok: true,
      bookingId,
      date: String(date),
      time: String(time),
      endTime,
    });
  } catch (e: any) {
    console.error("[demo/book] HATA:", e?.message);
    return res.status(500).json({ error: e?.message });
  }
});

// ─── ADMIN — bookings list ────────────────────────────────────────────
router.get("/admin/demo/bookings", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = String(req.query?.status ?? "all");
    const conditions: any[] = [];
    if (status !== "all") conditions.push(sql`status = ${status}`);
    const where = conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    const rows = await db.execute(sql`
      SELECT id, booking_date, start_time, end_time, duration_min,
             customer_name, customer_email, customer_phone, customer_company,
             message, status, admin_notes, meeting_link, created_at, updated_at
      FROM demo_bookings
      ${where}
      ORDER BY booking_date DESC, start_time DESC
      LIMIT 500
    `);
    return res.json({ bookings: rows.rows ?? rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── ADMIN — booking update ───────────────────────────────────────────
router.patch("/admin/demo/bookings/:id", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id ?? ""), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id" });
    const { status, admin_notes, meeting_link } = (req.body ?? {}) as any;
    const sets: any[] = [];
    if (status) sets.push(sql`status = ${status}`);
    if (admin_notes !== undefined) sets.push(sql`admin_notes = ${admin_notes || null}`);
    if (meeting_link !== undefined) sets.push(sql`meeting_link = ${meeting_link || null}`);
    if (!sets.length) return res.status(400).json({ error: "Güncellenecek alan yok" });
    sets.push(sql`updated_at = NOW()`);
    await db.execute(sql`UPDATE demo_bookings SET ${sql.join(sets, sql`, `)} WHERE id = ${id}`);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.delete("/admin/demo/bookings/:id", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id ?? ""), 10);
    await db.execute(sql`UPDATE demo_bookings SET status = 'cancelled', updated_at = NOW() WHERE id = ${id}`);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── ADMIN — availability CRUD ────────────────────────────────────────
router.get("/admin/demo/availability", authMiddleware, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT day_of_week, start_time::TEXT AS start_time, end_time::TEXT AS end_time, is_active
      FROM demo_availability ORDER BY day_of_week
    `);
    return res.json({ availability: rows.rows ?? rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.put("/admin/demo/availability", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const items = req.body?.items;
    if (!Array.isArray(items)) return res.status(400).json({ error: "items array olmalı" });
    for (const it of items) {
      const dow = parseInt(String(it.day_of_week), 10);
      if (dow < 0 || dow > 6) continue;
      const startTime = String(it.start_time || "09:00").slice(0, 5);
      const endTime = String(it.end_time || "18:00").slice(0, 5);
      const active = it.is_active !== false;
      await db.execute(sql`
        UPDATE demo_availability
        SET start_time = ${startTime}::TIME,
            end_time = ${endTime}::TIME,
            is_active = ${active},
            updated_at = NOW()
        WHERE day_of_week = ${dow}
      `);
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── ADMIN — blocks CRUD ──────────────────────────────────────────────
router.get("/admin/demo/blocks", authMiddleware, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT id, block_date::TEXT AS block_date,
             start_time::TEXT AS start_time, end_time::TEXT AS end_time,
             reason, created_at
      FROM demo_blocks
      WHERE block_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY block_date DESC
    `);
    return res.json({ blocks: rows.rows ?? rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.post("/admin/demo/blocks", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { block_date, start_time, end_time, reason } = (req.body ?? {}) as any;
    if (!isValidDate(String(block_date ?? ""))) return res.status(400).json({ error: "block_date YYYY-MM-DD" });
    const cleanReason = String(reason ?? "").slice(0, 200);
    const start = start_time ? sql`${String(start_time).slice(0, 5)}::TIME` : sql`NULL`;
    const end = end_time ? sql`${String(end_time).slice(0, 5)}::TIME` : sql`NULL`;
    const r = await db.execute(sql`
      INSERT INTO demo_blocks (block_date, start_time, end_time, reason)
      VALUES (${block_date}::DATE, ${start}, ${end}, ${cleanReason || null})
      RETURNING id
    `);
    return res.json({ ok: true, id: ((r.rows ?? r) as any[])[0]?.id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

router.delete("/admin/demo/blocks/:id", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id ?? ""), 10);
    await db.execute(sql`DELETE FROM demo_blocks WHERE id = ${id}`);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── Mail helpers ─────────────────────────────────────────────────────
function fmtDateTr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });
}

async function sendBookingConfirmationEmails(opts: {
  bookingId: number;
  date: string;
  time: string;
  endTime: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
}) {
  const dateFmt = fmtDateTr(opts.date);

  // ─── Müşteri onay maili ─────
  const customerHtml = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05);">
      <tr><td style="padding:32px;background:#1B365D;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:22px;">Randevunuz Onaylandı ✓</h1>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:15px;">Merhaba <strong>${opts.name}</strong>,</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
          Sphere English demo görüşmesi için randevunuz oluşturuldu. Aşağıda detaylar:
        </p>
        <div style="background:#f0f9ff;border:2px solid #0ea5e9;border-radius:8px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Tarih & Saat</p>
          <p style="margin:0;font-size:18px;font-weight:700;color:#1B365D;">${dateFmt}</p>
          <p style="margin:4px 0 0;font-size:16px;color:#0ea5e9;font-weight:600;">${opts.time} – ${opts.endTime}</p>
        </div>
        <p style="margin:0 0 12px;font-size:14px;color:#64748b;line-height:1.6;">
          Randevu saatinden 1 gün önce ve 1 saat önce hatırlatma göndereceğiz.
          Görüşme linki randevu gününde ayrıca iletilecek.
        </p>
        <p style="margin:16px 0 0;font-size:14px;color:#64748b;line-height:1.6;">
          Değişiklik/iptal için:
          <a href="mailto:info@sphereenglish.com" style="color:#0ea5e9;">info@sphereenglish.com</a>
        </p>
      </td></tr>
      <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;">
        Sphere English · <a href="https://www.sphereenglish.com" style="color:#0ea5e9;text-decoration:none;">sphereenglish.com</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  await sendEmail({
    to: opts.email,
    subject: `Randevu Onayı — ${dateFmt} ${opts.time}`,
    html: customerHtml,
  });

  // ─── Admin bildirim ─────
  const adminHtml = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#f9fafb;">
<h2 style="color:#1B365D;">Yeni Demo Randevusu 📅</h2>
<div style="background:#fff;border-radius:8px;padding:16px;border-left:4px solid #0ea5e9;">
  <p><strong>${opts.name}</strong> yeni bir demo randevusu aldı.</p>
  <ul style="line-height:1.8;color:#334155;">
    <li><strong>Tarih:</strong> ${dateFmt}</li>
    <li><strong>Saat:</strong> ${opts.time} – ${opts.endTime}</li>
    <li><strong>E-posta:</strong> <a href="mailto:${opts.email}">${opts.email}</a></li>
    ${opts.phone ? `<li><strong>Telefon:</strong> <a href="tel:${opts.phone.replace(/[^\d+]/g, "")}">${opts.phone}</a> · <a href="https://wa.me/${opts.phone.replace(/[^\d]/g, "")}">WhatsApp</a></li>` : ""}
    ${opts.company ? `<li><strong>Şirket:</strong> ${opts.company}</li>` : ""}
  </ul>
  ${opts.message ? `<div style="margin-top:12px;padding:12px;background:#f9fafb;border-radius:4px;"><strong>Mesaj:</strong><br>${opts.message.replace(/</g, "&lt;")}</div>` : ""}
  <p style="margin-top:16px;font-size:13px;color:#64748b;">Görüşme linki eklemeyi unutmayın — <a href="https://app.sphereenglish.com/admin/demo" style="color:#0ea5e9;">Admin Panel</a></p>
</div>
</body></html>`;

  await notifyAll(`[Sphere] Yeni demo randevusu — ${opts.name} · ${dateFmt} ${opts.time}`, adminHtml);
}

export default router;
