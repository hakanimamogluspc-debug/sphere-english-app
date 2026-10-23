/**
 * E-kitap dosyaları (kapak, galeri, önizleme, tam PDF) için tek giriş noktası.
 *
 *   Nesne deposu etkinse  → dosya bucket'a yazılır, ebook_assets.storage_key dolar, data_base64 NULL.
 *   Etkin değilse          → eskisi gibi data_base64'e yazılır (geriye uyumlu).
 * Okurken satırda hangisi doluysa oradan okunur — taşıma yarıda kalsa da her şey çalışır.
 */

import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { storageEnabled, putObject, getObjectBuffer, deleteObject, safeFilename } from "./object-storage.js";

export type StoredBytes = { storageKey: string | null; dataBase64: string | null };

/** Nesne anahtarı: ebooks/<ebookId>/<tür>/<uuid>-<dosya>. Saf fonksiyon. */
export function assetKey(ebookId: number, assetType: string, filename: string, id: string = randomUUID()): string {
  return `ebooks/${ebookId}/${assetType}/${id}-${safeFilename(filename)}`;
}

export async function storeAssetBytes(ebookId: number, assetType: string, filename: string, mime: string, buf: Buffer): Promise<StoredBytes> {
  if (!storageEnabled()) return { storageKey: null, dataBase64: buf.toString("base64") };
  const key = assetKey(ebookId, assetType, filename);
  await putObject(key, buf, mime);
  return { storageKey: key, dataBase64: null };
}

/** Tam içeriği Buffer olarak getir (önizleme üretimi gibi işlerde). */
export async function readAssetBytes(row: { storage_key?: string | null; data_base64?: string | null }): Promise<Buffer> {
  if (row.storage_key) return getObjectBuffer(row.storage_key);
  if (row.data_base64) return Buffer.from(row.data_base64, "base64");
  throw new Error("Asset içeriği yok");
}

/** Silinecek satırların bucket nesnelerini temizle (satır silmeden ÖNCE çağır). */
export async function deleteStoredObjects(where: { assetId?: number; ebookId?: number; ebookIdAndType?: [number, string] }): Promise<void> {
  if (!storageEnabled()) return;
  let q = "";
  let params: unknown[] = [];
  if (where.assetId !== undefined) { q = "id = $1"; params = [where.assetId]; }
  else if (where.ebookIdAndType) { q = "ebook_id = $1 AND asset_type = $2"; params = where.ebookIdAndType; }
  else if (where.ebookId !== undefined) { q = "ebook_id = $1"; params = [where.ebookId]; }
  else return;
  const { rows } = await pool.query(`SELECT storage_key FROM ebook_assets WHERE ${q} AND storage_key IS NOT NULL`, params);
  await Promise.all(rows.map((r: any) => deleteObject(r.storage_key)));
}

/**
 * Veritabanındaki (base64) dosyaları bucket'a taşı. İdempotent; parti parti çalışır.
 * Her dosya önce yüklenir, sonra satır güncellenir — yarıda kesilse veri kaybı olmaz.
 */
export async function migrateAssetsToStorage(limit = 20): Promise<{ moved: number; remaining: number; failed: Array<{ id: number; error: string }> }> {
  if (!storageEnabled()) throw new Error("Nesne deposu yapılandırılmamış (S3_* env).");
  const { rows } = await pool.query(
    `SELECT id, ebook_id, asset_type, filename, mime_type FROM ebook_assets
      WHERE storage_key IS NULL AND data_base64 IS NOT NULL ORDER BY id LIMIT $1`,
    [limit],
  );
  let moved = 0;
  const failed: Array<{ id: number; error: string }> = [];
  for (const r of rows) {
    try {
      // İçeriği tek tek çek (hepsini birden belleğe almamak için)
      const { rows: [d] } = await pool.query(`SELECT data_base64 FROM ebook_assets WHERE id = $1`, [r.id]);
      const buf = Buffer.from(d.data_base64, "base64");
      const key = assetKey(r.ebook_id, r.asset_type, r.filename);
      await putObject(key, buf, r.mime_type);
      await pool.query(
        `UPDATE ebook_assets SET storage_key = $2, data_base64 = NULL WHERE id = $1 AND storage_key IS NULL`,
        [r.id, key],
      );
      moved++;
    } catch (e: any) {
      failed.push({ id: r.id, error: String(e?.message ?? e).slice(0, 200) });
    }
  }
  const { rows: [c] } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM ebook_assets WHERE storage_key IS NULL AND data_base64 IS NOT NULL`,
  );
  return { moved, remaining: c.n, failed };
}

export async function storageStats(): Promise<{ inDb: number; inStorage: number; dbBytes: number; tableSize: string }> {
  const { rows: [r] } = await pool.query(`
    SELECT COUNT(*) FILTER (WHERE storage_key IS NULL AND data_base64 IS NOT NULL)::int AS in_db,
           COUNT(*) FILTER (WHERE storage_key IS NOT NULL)::int AS in_storage,
           COALESCE(SUM(octet_length(data_base64)), 0)::bigint AS db_bytes,
           pg_size_pretty(pg_total_relation_size('ebook_assets')) AS table_size
      FROM ebook_assets`);
  return { inDb: r.in_db, inStorage: r.in_storage, dbBytes: Number(r.db_bytes), tableSize: r.table_size };
}
