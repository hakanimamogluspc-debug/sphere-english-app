/**
 * Nesne deposu (Hetzner Object Storage — S3 uyumlu).
 *
 * Env (dördü de varsa etkin; yoksa uygulama eski davranışla — dosyalar veritabanında — çalışır):
 *   S3_ENDPOINT     https://fsn1.your-objectstorage.com   (konum kodu dahil: fsn1 / nbg1 / hel1)
 *   S3_BUCKET       sphere-files
 *   S3_ACCESS_KEY   Hetzner Console → Object Storage → Security credentials
 *   S3_SECRET_KEY
 *   S3_REGION       (opsiyonel; varsayılan endpoint'teki konum kodu, ör. "fsn1")
 *
 * Bucket PRIVATE olmalı. Dışarıya hiçbir nesne doğrudan açılmaz:
 *   - görseller sunucu üzerinden akıtılır (URL'ler değişmez, tarayıcı 30 gün önbellekte tutar)
 *   - satın alınan PDF'ler birkaç dakikalık süreli (imzalı) bağlantıyla doğrudan buradan iner
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

let _client: S3Client | null = null;

export function storageEnabled(): boolean {
  const e = process.env;
  return Boolean(e.S3_ENDPOINT && e.S3_BUCKET && e.S3_ACCESS_KEY && e.S3_SECRET_KEY);
}

function bucket(): string {
  return process.env.S3_BUCKET!;
}

/** "https://fsn1.your-objectstorage.com" → "fsn1". Saf fonksiyon. */
export function regionFromEndpoint(endpoint: string): string {
  try {
    const host = new URL(endpoint).hostname;
    const first = host.split(".")[0];
    return /^[a-z]{3}\d$/i.test(first) ? first : "us-east-1";
  } catch {
    return "us-east-1";
  }
}

function client(): S3Client {
  if (!_client) {
    const endpoint = process.env.S3_ENDPOINT!;
    _client = new S3Client({
      endpoint,
      region: process.env.S3_REGION || regionFromEndpoint(endpoint),
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
      forcePathStyle: false, // Hetzner sanal-host adreslemesi kullanır (bucket.fsn1.your-objectstorage.com)
      // Yeni SDK sürümlerinin varsayılan CRC32 sağlama başlıkları bazı S3 uyumlu servislerde reddediliyor
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      maxAttempts: 3,
    });
  }
  return _client;
}

/** Dosya adını nesne anahtarında güvenli kullanılacak hâle getir. Saf fonksiyon. */
export function safeFilename(name: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U" };
  const cleaned = name
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => map[c] ?? c)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-120);
  return cleaned || "file";
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await client().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentLength: body.length,
  }));
}

export async function getObjectStream(key: string): Promise<{ stream: Readable; contentType?: string; contentLength?: number }> {
  const r = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return { stream: r.Body as Readable, contentType: r.ContentType, contentLength: r.ContentLength };
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const { stream } = await getObjectStream(key);
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

/** Süreli indirme bağlantısı (varsayılan 5 dk). Dosya adıyla "indir" olarak açılır. */
export async function presignDownload(key: string, filename: string, contentType: string, expiresSec = 300): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safeFilename(filename)}"`,
      ResponseContentType: contentType,
    }),
    { expiresIn: expiresSec },
  );
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  } catch (e: any) {
    console.warn("[object-storage] silinemedi:", key, e?.message);
  }
}

/** Bağlantı testi (admin durum ekranı için). */
export async function checkStorage(): Promise<{ ok: boolean; error?: string }> {
  if (!storageEnabled()) return { ok: false, error: "S3_* ortam değişkenleri tanımlı değil" };
  try {
    await client().send(new HeadBucketCommand({ Bucket: bucket() }));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: `${e?.name ?? "Hata"}: ${e?.message ?? ""}`.slice(0, 300) };
  }
}
