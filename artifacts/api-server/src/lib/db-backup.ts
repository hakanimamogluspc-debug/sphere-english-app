/**
 * DB otomatik yedek — günlük pg_dump + 7 gün retention.
 *
 * Günde bir kez (03:00 TR) /app/backups/ klasörüne sphere_YYYYMMDD.sql.gz olarak yazar.
 * 7 günden eski yedekleri siler.
 *
 * Env:
 *   DATABASE_URL          — postgres connection string
 *   BACKUP_DIR            — yedek klasörü (default /app/backups)
 *   BACKUP_RETENTION_DAYS — kaç gün tut (default 7)
 *   BACKUP_HOUR_UTC       — UTC saat (default 0 = TR 03:00)
 *
 * NOT: pg_dump CLI gerekir. nixpacks.toml'da postgresql_16 eklendi.
 */

import { spawn } from "node:child_process";
import { createWriteStream, promises as fs } from "node:fs";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { captureException } from "./sentry.js";
import { offsiteConfigured, offsiteMissing, shipBackup, pruneRemote, recordRun } from "./backup-offsite.js";

/** Bundan küçük bir yedek dosyası "boş" sayılır (gerçek bir dump sıkıştırılmış hâlde bile onlarca KB'tır). */
const MIN_BACKUP_BYTES = 10 * 1024;

/**
 * pg_dump'ı doğrudan çalıştır, çıktısını Node içinde gzip'le dosyaya yaz.
 * Eskiden `pg_dump | gzip > dosya` kabuk boru hattı kullanılıyordu: pg_dump hata verse bile
 * (ör. sürüm uyuşmazlığı) gzip boş dosya yazıp başarılı dönüyor ve hata yutuluyordu.
 * Şimdi pg_dump'ın çıkış kodu ve hata çıktısı kontrol ediliyor.
 */
async function dumpToGzip(dbUrl: string, filepath: string): Promise<void> {
  const child = spawn("pg_dump", [dbUrl, "--format=plain", "--no-owner", "--no-acl"], { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (d) => { if (stderr.length < 4000) stderr += String(d); });
  const exited = new Promise<number>((resolve, reject) => {
    child.on("error", reject); // pg_dump bulunamadı vb.
    child.on("close", (code) => resolve(code ?? -1));
  });
  const timer = setTimeout(() => child.kill("SIGTERM"), 30 * 60 * 1000);
  try {
    await pipeline(child.stdout, createGzip({ level: 6 }), createWriteStream(filepath));
    const code = await exited;
    if (code !== 0) {
      throw new Error(`pg_dump çıkış kodu ${code}: ${stderr.trim().slice(0, 600) || "(hata çıktısı yok)"}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function backupDir(): string {
  return process.env["BACKUP_DIR"] ?? "/app/backups";
}

function retentionDays(): number {
  return parseInt(process.env["BACKUP_RETENTION_DAYS"] ?? "7", 10);
}

function backupHourUtc(): number {
  return parseInt(process.env["BACKUP_HOUR_UTC"] ?? "0", 10);
}

/**
 * Tek seferlik backup tetikleyici.
 */
export async function runBackup(): Promise<{
  ok: boolean;
  path?: string;
  sizeBytes?: number;
  durationMs?: number;
  error?: string;
  remote?: { ok: boolean; file?: string; bytes?: number; error?: string; skipped?: string };
}> {
  const start = Date.now();
  const dir = backupDir();
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) return { ok: false, error: "DATABASE_URL tanımlı değil" };

  try {
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `sphere_${stamp}_${Date.now()}.sql.gz`;
    const filepath = path.join(dir, filename);

    // pg_dump → gzip → dosya. format=p (plain SQL) çoğu kurtarma senaryosunda en esnek.
    try {
      await dumpToGzip(dbUrl, filepath);
    } catch (e) {
      await fs.unlink(filepath).catch(() => {});
      throw e;
    }

    const stat = await fs.stat(filepath);
    if (stat.size < MIN_BACKUP_BYTES) {
      await fs.unlink(filepath).catch(() => {});
      throw new Error(`Yedek dosyası şüpheli derecede küçük (${stat.size} bayt) — pg_dump çıktı üretmedi`);
    }
    const durationMs = Date.now() - start;

    console.info(
      `[db-backup] OK: ${filename} (${(stat.size / 1024 / 1024).toFixed(2)} MB, ${(durationMs / 1000).toFixed(1)}s)`,
    );

    // Sunucu dışı kopya (Hetzner Storage Box) — şifreli
    let remote: { ok: boolean; file?: string; bytes?: number; error?: string; skipped?: string };
    if (!offsiteConfigured()) {
      remote = { ok: false, skipped: `Sunucu dışı yedek yapılandırılmamış (eksik: ${offsiteMissing().join(", ")})` };
      console.warn(`[db-backup] ${remote.skipped}`);
    } else {
      try {
        const shipped = await shipBackup(filepath);
        remote = { ok: true, file: shipped.remoteFile, bytes: shipped.remoteBytes };
        console.info(`[db-backup] Storage Box'a yüklendi: ${shipped.remoteFile}`);
        pruneRemote().then((p) => p.deleted && console.info(`[db-backup] uzakta ${p.deleted} eski yedek silindi`))
          .catch((e) => console.warn("[db-backup] uzak temizlik hatası:", e?.message));
      } catch (e: any) {
        remote = { ok: false, error: e?.message ?? "bilinmeyen" };
        console.error("[db-backup] Storage Box HATA:", e?.message);
        captureException(e, { source: "db-backup-offsite" });
      }
    }
    await recordRun({
      localFile: filename, localBytes: stat.size,
      remoteFile: remote.file, remoteBytes: remote.bytes,
      remoteOk: remote.skipped ? null : remote.ok, error: remote.error ?? remote.skipped ?? null,
      durationMs: Date.now() - start,
    });
    return { ok: true, path: filepath, sizeBytes: stat.size, durationMs, remote };
  } catch (e: any) {
    console.error("[db-backup] HATA:", e?.message);
    captureException(e, { source: "db-backup" });
    await recordRun({ remoteOk: false, error: `Yerel yedek alınamadı: ${e?.message ?? "bilinmeyen"}`, durationMs: Date.now() - start });
    return { ok: false, error: e?.message ?? "bilinmeyen" };
  }
}

/**
 * Eski yedekleri sil.
 */
export async function pruneOldBackups(): Promise<{ deleted: number }> {
  const dir = backupDir();
  const days = retentionDays();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let deleted = 0;
  try {
    const files = await fs.readdir(dir).catch(() => []);
    for (const f of files) {
      if (!f.startsWith("sphere_") || !f.endsWith(".sql.gz")) continue;
      const full = path.join(dir, f);
      const stat = await fs.stat(full).catch(() => null);
      if (stat && stat.mtimeMs < cutoff) {
        await fs.unlink(full).catch(() => null);
        deleted++;
        console.info(`[db-backup] eski yedek silindi: ${f}`);
      }
    }
  } catch (e: any) {
    console.error("[db-backup] prune HATA:", e?.message);
  }
  return { deleted };
}

/**
 * Tüm yedekleri listele.
 */
export async function listBackups(): Promise<
  Array<{ name: string; sizeBytes: number; createdAt: string }>
> {
  const dir = backupDir();
  try {
    const files = await fs.readdir(dir).catch(() => []);
    const results = [];
    for (const f of files) {
      if (!f.startsWith("sphere_") || !f.endsWith(".sql.gz")) continue;
      const full = path.join(dir, f);
      const stat = await fs.stat(full).catch(() => null);
      if (stat) {
        results.push({
          name: f,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
        });
      }
    }
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

/**
 * Cron scheduler — basit setInterval tabanlı.
 * Her 1 saatte bir kontrol eder, hedef saatte ve son backup'tan en az 23 saat geçtiyse tetikler.
 */
let cronStarted = false;
let lastBackupAt = 0;

export function startBackupCron(): void {
  if (cronStarted) return;
  cronStarted = true;
  const targetHour = backupHourUtc();

  const tick = async () => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const sinceLast = Date.now() - lastBackupAt;
    if (utcHour === targetHour && sinceLast > 23 * 60 * 60 * 1000) {
      lastBackupAt = Date.now();
      console.info(`[db-backup] Cron tetiklendi (UTC ${targetHour}:00)`);
      const r = await runBackup();
      if (r.ok) await pruneOldBackups();
    }
  };

  // İlk kontrol 5 dakika sonra (startup'ı tıkamasın), sonra her 30 dakikada bir
  setTimeout(() => {
    tick().catch(() => {});
    setInterval(() => {
      tick().catch(() => {});
    }, 30 * 60 * 1000);
  }, 5 * 60 * 1000);

  console.info(`[db-backup] Cron aktif — günlük UTC ${targetHour}:00 (TR ${(targetHour + 3) % 24}:00)`);
}
