/**
 * Sunucu dışı yedek — Hetzner Storage Box (WebDAV üzerinden).
 *
 * Her gece db-backup.ts'nin ürettiği sphere_*.sql.gz dosyası:
 *   1. AES-256-GCM ile şifrelenir (anahtar: BACKUP_ENCRYPTION_KEY — sunucuda ve güvenli bir yerde saklayın!)
 *   2. Storage Box'a yüklenir (…/sphere-backups/sphere_YYYYMMDD_*.sql.gz.enc)
 *   3. BACKUP_REMOTE_RETENTION_DAYS (varsayılan 30) günden eskiler silinir
 *
 * Env:
 *   BACKUP_WEBDAV_URL       https://u123456.your-storagebox.de/sphere-backups   (klasör yoksa oluşturulur)
 *   BACKUP_WEBDAV_USER      u123456   (tercihen yalnız bu klasöre erişen bir alt hesap: u123456-sub1)
 *   BACKUP_WEBDAV_PASS
 *   BACKUP_ENCRYPTION_KEY   en az 24 karakter rastgele parola (openssl rand -base64 32)
 *   BACKUP_REMOTE_RETENTION_DAYS  (opsiyonel, varsayılan 30)
 *
 * Şifre çözme: node artifacts/api-server/scripts/decrypt-backup.mjs <dosya.enc> <çıktı.sql.gz>  (BACKUP.md)
 *
 * Dosya biçimi: "SPHBK1" (6 bayt) | salt (16) | iv (12) | şifreli veri | GCM etiketi (16)
 */

import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { pool } from "@workspace/db";

const MAGIC = Buffer.from("SPHBK1");
const TAG_LEN = 16;

export function offsiteConfigured(): boolean {
  const e = process.env;
  return Boolean(e.BACKUP_WEBDAV_URL && e.BACKUP_WEBDAV_USER && e.BACKUP_WEBDAV_PASS && e.BACKUP_ENCRYPTION_KEY);
}

export function offsiteMissing(): string[] {
  const keys = ["BACKUP_WEBDAV_URL", "BACKUP_WEBDAV_USER", "BACKUP_WEBDAV_PASS", "BACKUP_ENCRYPTION_KEY"];
  return keys.filter((k) => !process.env[k]);
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

// ─── Şifreleme ────────────────────────────────────────────────────────────────

export async function encryptFile(inPath: string, outPath: string, passphrase: string): Promise<void> {
  if (!passphrase || passphrase.length < 16) throw new Error("BACKUP_ENCRYPTION_KEY çok kısa (en az 16 karakter)");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  const out = await fs.open(outPath, "w");
  try {
    await out.write(Buffer.concat([MAGIC, salt, iv]));
    for await (const chunk of createReadStream(inPath).pipe(cipher)) await out.write(chunk as Buffer);
    await out.write(cipher.getAuthTag());
  } finally {
    await out.close();
  }
}

export async function decryptFile(inPath: string, outPath: string, passphrase: string): Promise<void> {
  const fh = await fs.open(inPath, "r");
  try {
    const { size } = await fh.stat();
    const header = Buffer.alloc(MAGIC.length + 16 + 12);
    await fh.read(header, 0, header.length, 0);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Bu bir Sphere yedek dosyası değil");
    const salt = header.subarray(MAGIC.length, MAGIC.length + 16);
    const iv = header.subarray(MAGIC.length + 16);
    const tag = Buffer.alloc(TAG_LEN);
    await fh.read(tag, 0, TAG_LEN, size - TAG_LEN);
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
    decipher.setAuthTag(tag);
    await pipeline(
      createReadStream(inPath, { start: header.length, end: size - TAG_LEN - 1 }),
      decipher,
      createWriteStream(outPath),
    );
  } finally {
    await fh.close();
  }
}

// ─── WebDAV ───────────────────────────────────────────────────────────────────

function baseUrl(): string {
  return process.env.BACKUP_WEBDAV_URL!.replace(/\/+$/, "");
}
function authHeader(): string {
  return "Basic " + Buffer.from(`${process.env.BACKUP_WEBDAV_USER}:${process.env.BACKUP_WEBDAV_PASS}`).toString("base64");
}

async function dav(method: string, url: string, init: RequestInit & { duplex?: "half" } = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30 * 60 * 1000);
  try {
    return await fetch(url, { ...init, method, headers: { Authorization: authHeader(), ...(init.headers || {}) }, signal: ctrl.signal } as any);
  } finally {
    clearTimeout(t);
  }
}

async function ensureRemoteDir(): Promise<void> {
  const r = await dav("MKCOL", baseUrl() + "/");
  // 201 oluşturuldu, 405 zaten var
  if (![201, 405].includes(r.status) && !r.ok) {
    throw new Error(`Storage Box klasörü oluşturulamadı: HTTP ${r.status} ${await r.text().catch(() => "")}`.slice(0, 300));
  }
}

export async function uploadFile(localPath: string, remoteName: string): Promise<number> {
  await ensureRemoteDir();
  const { size } = await fs.stat(localPath);
  const body = Readable.toWeb(createReadStream(localPath)) as any;
  const r = await dav("PUT", `${baseUrl()}/${encodeURIComponent(remoteName)}`, {
    body,
    duplex: "half",
    headers: { "Content-Type": "application/octet-stream", "Content-Length": String(size) },
  });
  if (!r.ok) throw new Error(`Storage Box yükleme hatası: HTTP ${r.status} ${await r.text().catch(() => "")}`.slice(0, 300));
  return size;
}

export async function listRemote(): Promise<Array<{ name: string; sizeBytes: number | null }>> {
  const r = await dav("PROPFIND", baseUrl() + "/", { headers: { Depth: "1" } });
  if (r.status === 404) return [];
  if (!r.ok && r.status !== 207) throw new Error(`Storage Box listeleme hatası: HTTP ${r.status}`);
  return parsePropfind(await r.text());
}

/** PROPFIND XML'inden sphere yedek dosyalarını çıkar. Saf fonksiyon. */
export function parsePropfind(xml: string): Array<{ name: string; sizeBytes: number | null }> {
  const out: Array<{ name: string; sizeBytes: number | null }> = [];
  const responses = xml.split(/<(?:[a-z]+:)?response[\s>]/i).slice(1);
  for (const block of responses) {
    const href = block.match(/<(?:[a-z]+:)?href>([^<]+)<\/(?:[a-z]+:)?href>/i)?.[1];
    if (!href) continue;
    const name = decodeURIComponent(href.replace(/\/+$/, "").split("/").pop() || "");
    if (!/^sphere_\d{8}_.*\.sql\.gz\.enc$/.test(name)) continue;
    const len = block.match(/<(?:[a-z]+:)?getcontentlength>(\d+)</i)?.[1];
    out.push({ name, sizeBytes: len ? Number(len) : null });
  }
  return out.sort((a, b) => b.name.localeCompare(a.name));
}

/** Dosya adındaki tarihten eski olanları seç. Saf fonksiyon. */
export function selectExpired(names: string[], retentionDays: number, now = new Date()): string[] {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const cutoffStamp = cutoff.toISOString().slice(0, 10).replace(/-/g, "");
  return names.filter((n) => {
    const m = n.match(/^sphere_(\d{8})_/);
    return m ? m[1] < cutoffStamp : false;
  });
}

export async function pruneRemote(): Promise<{ deleted: number }> {
  const days = Math.max(1, Number(process.env.BACKUP_REMOTE_RETENTION_DAYS) || 30);
  const items = await listRemote();
  const expired = selectExpired(items.map((i) => i.name), days);
  let deleted = 0;
  for (const name of expired) {
    const r = await dav("DELETE", `${baseUrl()}/${encodeURIComponent(name)}`);
    if (r.ok || r.status === 404) deleted++;
  }
  return { deleted };
}

// ─── Kayıt ────────────────────────────────────────────────────────────────────

async function ensureRunsTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS backup_runs (
    id SERIAL PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    local_file VARCHAR(300),
    local_bytes BIGINT,
    remote_file VARCHAR(300),
    remote_bytes BIGINT,
    remote_ok BOOLEAN,
    error TEXT,
    duration_ms INTEGER)`);
}

export async function recordRun(r: { localFile?: string; localBytes?: number; remoteFile?: string; remoteBytes?: number; remoteOk: boolean | null; error?: string | null; durationMs: number }) {
  try {
    await ensureRunsTable();
    await pool.query(
      `INSERT INTO backup_runs (local_file, local_bytes, remote_file, remote_bytes, remote_ok, error, duration_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [r.localFile ?? null, r.localBytes ?? null, r.remoteFile ?? null, r.remoteBytes ?? null, r.remoteOk, r.error ?? null, r.durationMs],
    );
  } catch (e: any) {
    console.warn("[backup-offsite] kayıt yazılamadı:", e?.message);
  }
}

export async function recentRuns(limit = 10) {
  await ensureRunsTable();
  const { rows } = await pool.query(`SELECT * FROM backup_runs ORDER BY id DESC LIMIT $1`, [limit]);
  return rows;
}

/** Yerel yedeği şifreleyip Storage Box'a gönder. */
export async function shipBackup(localPath: string): Promise<{ remoteFile: string; remoteBytes: number }> {
  const encPath = `${localPath}.enc`;
  try {
    await encryptFile(localPath, encPath, process.env.BACKUP_ENCRYPTION_KEY!);
    const remoteFile = path.basename(encPath);
    const remoteBytes = await uploadFile(encPath, remoteFile);
    return { remoteFile, remoteBytes };
  } finally {
    await fs.unlink(encPath).catch(() => {});
  }
}

