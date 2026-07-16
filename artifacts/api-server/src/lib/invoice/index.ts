/**
 * Invoice service — public API.
 * Uygulama kodu buradan çağırır, provider'a bakmaz.
 */

import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { LucaProvider } from "./luca-provider.js";
import type {
  InvoiceProvider,
  IssueInvoiceInput,
  IssueInvoiceResult,
  InvoiceBuyer,
  InvoiceLineItem,
  InvoiceType,
} from "./types.js";
import { decideInvoiceType } from "./types.js";

export type { IssueInvoiceInput, IssueInvoiceResult, InvoiceBuyer, InvoiceLineItem } from "./types.js";
export { decideInvoiceType } from "./types.js";

// ─── Singleton provider ────────────────────────────────────────────────
let _provider: InvoiceProvider | null = null;
function getProvider(): InvoiceProvider {
  if (!_provider) {
    // Şu an sadece Luca — yarın: process.env.INVOICE_PROVIDER'a göre switch
    _provider = new LucaProvider();
  }
  return _provider;
}

/**
 * Fatura kes + DB'ye kaydet (idempotent — aynı source için tekrar çağırınca skip).
 *
 * Kullanım:
 *   const r = await issueInvoiceForSource({ source: {type:'ebook', id: 42}, buyer, lineItems });
 *   if (r.ok) console.log(r.ettn);
 */
export async function issueInvoiceForSource(input: IssueInvoiceInput): Promise<IssueInvoiceResult & { skipped?: boolean }> {
  // Idempotency: aynı kaynak için sent/pending kayıt varsa skip
  try {
    const existing = await db.execute(sql`
      SELECT id, ettn, status, viewer_url FROM invoices
      WHERE source_type = ${input.source.type} AND source_id = ${input.source.id}
        AND status IN ('sent','pending')
      LIMIT 1
    `);
    const row = (existing.rows ?? existing)[0] as any;
    if (row) {
      console.info(`[invoice] SKIP: ${input.source.type}#${input.source.id} zaten var (id=${row.id}, ettn=${row.ettn})`);
      return {
        ok: true,
        invoiceId: Number(row.id),
        ettn: row.ettn,
        viewerUrl: row.viewer_url ?? undefined,
        skipped: true,
      };
    }
  } catch (e: any) {
    console.error("[invoice] idempotency check hata:", e?.message);
  }

  // Toplamlar
  let subtotalKurus = 0;
  let discountKurus = 0;
  let vatKurus = 0;
  for (const it of input.lineItems) {
    const gross = it.unitPriceKurus * it.quantity;
    const disc = it.discountKurus ?? 0;
    const lineExt = gross - disc;
    subtotalKurus += lineExt;
    discountKurus += disc;
    vatKurus += Math.round((lineExt * it.vatRate) / 100);
  }
  const totalKurus = subtotalKurus + vatKurus;

  const provider = getProvider();
  const invoiceType = decideInvoiceType(input.buyer);

  // Pending DB kaydı — provider çağrısı öncesi
  const insertPending = await db.execute(sql`
    INSERT INTO invoices (
      provider, env, invoice_type, scenario,
      invoice_date,
      source_type, source_id, order_id,
      buyer_email, buyer_name, buyer_type, buyer_tax_id, buyer_tax_office,
      buyer_company_name, buyer_receiver_inbox_tag,
      buyer_address, buyer_city, buyer_district, buyer_postal_code, buyer_country,
      currency, subtotal_kurus, discount_kurus, vat_kurus, total_kurus,
      line_items, status, attempts
    ) VALUES (
      ${provider.name}, ${provider.env}, ${invoiceType}, ${invoiceType === "einvoice" ? "TEMELFATURA" : null},
      ${new Date().toISOString().slice(0, 10)}::DATE,
      ${input.source.type}, ${input.source.id}, ${input.source.orderId ?? null},
      ${input.buyer.email}, ${input.buyer.name}, ${input.buyer.type},
      ${input.buyer.taxId ?? null}, ${input.buyer.taxOffice ?? null},
      ${input.buyer.companyName ?? null}, ${input.buyer.receiverInboxTag ?? null},
      ${input.buyer.address ?? null}, ${input.buyer.city ?? null},
      ${input.buyer.district ?? null}, ${input.buyer.postalCode ?? null},
      ${input.buyer.country ?? "Türkiye"},
      'TRY', ${subtotalKurus}, ${discountKurus}, ${vatKurus}, ${totalKurus},
      ${JSON.stringify(input.lineItems)}::jsonb, 'pending', 0
    )
    RETURNING id
  `);
  const invoiceId = Number(((insertPending.rows ?? insertPending)[0] as any)?.id);

  // Provider'a gönder
  const result = await provider.issueInvoice(input);

  // DB güncelle
  if (result.ok) {
    await db.execute(sql`
      UPDATE invoices SET
        status = 'sent',
        ettn = ${result.ettn ?? null},
        external_invoice_code = ${result.externalInvoiceCode ?? null},
        provider_response = ${JSON.stringify(result.rawResponse ?? {}).slice(0, 10000)}::jsonb,
        sent_at = NOW(),
        attempts = attempts + 1,
        updated_at = NOW()
      WHERE id = ${invoiceId}
    `);
    // Viewer URL'i SYNC al — mail tetiklenene kadar hazır olmalı
    // 2-3 sn ekstra ama garanti timing
    let viewerUrl: string | undefined;
    if (result.ettn) {
      try {
        const v = await provider.getViewerUrl(result.ettn, invoiceType);
        if (v?.url) {
          viewerUrl = v.url;
          await db.execute(sql`
            UPDATE invoices SET viewer_url = ${v.url}, viewer_url_expires_at = ${v.expiresAt.toISOString()}::TIMESTAMPTZ
            WHERE id = ${invoiceId}
          `);
        }
      } catch (e: any) {
        console.warn("[invoice] viewer URL hata:", e?.message);
      }
    }
    return {
      ok: true,
      invoiceId,
      ettn: result.ettn,
      externalInvoiceCode: result.externalInvoiceCode,
      viewerUrl,
    };
  }

  // Fail → DB güncelle
  await db.execute(sql`
    UPDATE invoices SET
      status = 'failed',
      last_error = ${(result.error ?? "").slice(0, 1000)},
      attempts = attempts + 1,
      updated_at = NOW()
    WHERE id = ${invoiceId}
  `);
  console.error(`[invoice] issue failed: ${input.source.type}#${input.source.id} → ${result.error}`);
  return { ok: false, invoiceId, error: result.error };
}

/**
 * VKN doğrulama — checkout formunda kurumsal seçilirse çağırılır.
 * e-Fatura mükellefi ise inbox tag döner (frontend saklayıp gönderir).
 */
export async function lookupTaxPayer(taxCode: string) {
  return await getProvider().lookupTaxPayer(taxCode);
}

/**
 * Sağlık kontrolü — admin panelde smoke test için.
 */
export async function invoiceHealthCheck() {
  const provider = getProvider();
  return await provider.healthCheck();
}

/**
 * ETTN ile viewer URL yeniden al (kullanıcıya fatura göstermek için).
 */
export async function refreshViewerUrl(invoiceId: number) {
  const rows = await db.execute(sql`
    SELECT ettn, invoice_type FROM invoices WHERE id = ${invoiceId} LIMIT 1
  `);
  const row = (rows.rows ?? rows)[0] as any;
  if (!row?.ettn) return null;

  const provider = getProvider();
  const v = await provider.getViewerUrl(row.ettn, row.invoice_type);
  if (!v) return null;

  await db.execute(sql`
    UPDATE invoices SET viewer_url = ${v.url}, viewer_url_expires_at = ${v.expiresAt.toISOString()}::TIMESTAMPTZ
    WHERE id = ${invoiceId}
  `);
  return v;
}

/**
 * E-Arşiv iptal (e-Fatura'da destek yok).
 */
export async function cancelInvoice(invoiceId: number, reason: string) {
  const rows = await db.execute(sql`
    SELECT ettn, invoice_type, status FROM invoices WHERE id = ${invoiceId} LIMIT 1
  `);
  const row = (rows.rows ?? rows)[0] as any;
  if (!row) return { ok: false, error: "Fatura bulunamadı" };
  if (row.invoice_type !== "earchive") {
    return { ok: false, error: "e-Fatura iptal edilemez, alıcı ticari red göndermeli" };
  }
  if (row.status === "canceled") {
    return { ok: false, error: "Fatura zaten iptal" };
  }

  const provider = getProvider();
  const r = await provider.cancelInvoice({ invoiceId, ettn: row.ettn, reason });
  if (r.ok) {
    await db.execute(sql`
      UPDATE invoices SET
        status = 'canceled', canceled_at = NOW(), cancellation_reason = ${reason},
        updated_at = NOW()
      WHERE id = ${invoiceId}
    `);
  }
  return r;
}
