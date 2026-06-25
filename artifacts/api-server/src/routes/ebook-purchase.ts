/**
 * E-kitap satın alma + indirme.
 *
 * Endpoint'ler:
 *   POST /api/internal/ebook-purchase/activate  → Iyzico callback'inden gelen başarılı ödemeyi kaydet
 *                                                  HMAC X-Internal-Signature ile authenticate
 *   GET  /api/ebooks/download?token=X           → Token ile tam PDF'i stream et (max 10 indirme, 7 gün geçerli)
 */

import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router = Router();

function verifySignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const secret = process.env["INTERNAL_API_SHARED_SECRET"];
  if (!secret) {
    console.error("[INTERNAL] INTERNAL_API_SHARED_SECRET tanımlı değil");
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── INTERNAL: Aktivasyon ────────────────────────────────────────────────
router.post("/internal/ebook-purchase/activate", async (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["x-internal-signature"];

  if (!verifySignature(rawBody, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ error: "Geçersiz imza" });
  }

  const {
    ebookId, buyerEmail, buyerName, amountPaid, currency,
    iyzicoPaymentId, iyzicoConversationId, downloadToken, paidAt,
  } = (req.body ?? {}) as any;

  if (!ebookId || !buyerEmail || !downloadToken) {
    return res.status(400).json({ error: "Eksik alan: ebookId, buyerEmail, downloadToken" });
  }

  try {
    // Kitabın varlığını doğrula
    const eb = await db.execute(sql`SELECT id FROM ebooks WHERE id = ${ebookId} LIMIT 1`);
    if (!(eb.rows ?? eb)[0]) return res.status(404).json({ error: "Kitap bulunamadı" });

    // Email ile mevcut kullanıcı varsa user_id'yi yakalа
    const userRows = await db.execute(sql`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${buyerEmail}) LIMIT 1
    `);
    const userId = (userRows.rows ?? userRows)[0]?.id ?? null;

    // Download token süresi: 7 gün
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.execute(sql`
      INSERT INTO ebook_purchases (
        ebook_id, user_id, buyer_email, buyer_name,
        amount_paid, currency,
        iyzico_payment_id, iyzico_conversation_id,
        download_token, download_expires_at, paid_at
      ) VALUES (
        ${ebookId}, ${userId}, ${buyerEmail.toLowerCase()}, ${buyerName ?? null},
        ${amountPaid ?? 0}, ${currency ?? "TRY"},
        ${iyzicoPaymentId ?? null}, ${iyzicoConversationId ?? null},
        ${downloadToken}, ${expiresAt}, ${paidAt ?? new Date().toISOString()}
      )
    `);

    console.info(`[EBOOK-PURCHASE] Yeni satış: ebookId=${ebookId} buyer=${buyerEmail}`);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[EBOOK-PURCHASE] activate HATA:", e?.message);
    return res.status(500).json({ error: "Kayıt başarısız: " + e?.message });
  }
});

// ─── PUBLIC: Tam PDF indirme (token ile) ─────────────────────────────────
// CORS açık, çoğu tarayıcıdan link tıklanır
router.get("/ebooks/download", async (req: Request, res: Response) => {
  const token = String(req.query?.token ?? "").trim();
  if (!token) return res.status(400).send("Token eksik");

  try {
    // Token + süre + indirme sayısı kontrolü
    const rows = await db.execute(sql`
      SELECT id, ebook_id, download_count, download_expires_at
      FROM ebook_purchases
      WHERE download_token = ${token}
      LIMIT 1
    `);
    const purchase = (rows.rows ?? rows)[0] as any;

    if (!purchase) return res.status(404).send("Geçersiz indirme bağlantısı");
    if (new Date(purchase.download_expires_at) < new Date()) {
      return res.status(410).send("İndirme bağlantısının süresi dolmuş (7 gün)");
    }
    if (purchase.download_count >= 10) {
      return res.status(429).send("İndirme limiti doldu (max 10). Destek ile iletişime geçin.");
    }

    // Full PDF asset'i bul
    const assetRows = await db.execute(sql`
      SELECT filename, mime_type, size_bytes, data_base64
      FROM ebook_assets
      WHERE ebook_id = ${purchase.ebook_id} AND asset_type = 'full'
      LIMIT 1
    `);
    const asset = (assetRows.rows ?? assetRows)[0] as any;
    if (!asset) {
      console.error(`[EBOOK-DOWNLOAD] Full PDF asset yok: ebookId=${purchase.ebook_id}`);
      return res.status(500).send("PDF dosyası bulunamadı. Lütfen destek ile iletişime geçin.");
    }

    // Counter ++
    await db.execute(sql`
      UPDATE ebook_purchases SET download_count = download_count + 1
      WHERE id = ${purchase.id}
    `);

    res.setHeader("Content-Type", asset.mime_type || "application/pdf");
    res.setHeader("Content-Length", String(asset.size_bytes));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asset.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const buf = Buffer.from(asset.data_base64, "base64");
    return res.send(buf);
  } catch (e: any) {
    console.error("[EBOOK-DOWNLOAD] HATA:", e?.message);
    return res.status(500).send("İndirme hatası");
  }
});

export default router;
