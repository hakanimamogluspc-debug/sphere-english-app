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

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import { captureException } from "./sentry.js";

const execAsync = promisify(exec);

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

    // pg_dump → gzip → file. format=p (plain SQL) çoğu kurtarma senaryosunda en esnek.
    const cmd = `pg_dump "${dbUrl}" --format=plain --no-owner --no-acl | gzip > "${filepath}"`;
    await execAsync(cmd, { maxBuffer: 1024 * 1024 * 512, timeout: 30 * 60 * 1000 });

    const stat = await fs.stat(filepath);
    const durationMs = Date.now() - start;

    console.info(
      `[db-backup] OK: ${filename} (${(stat.size / 1024 / 1024).toFixed(2)} MB, ${(durationMs / 1000).toFixed(1)}s)`,
    );
    return { ok: true, path: filepath, sizeBytes: stat.size, durationMs };
  } catch (e: any) {
    console.error("[db-backup] HATA:", e?.message);
    captureException(e, { source: "db-backup" });
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
