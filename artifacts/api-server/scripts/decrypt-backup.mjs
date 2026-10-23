#!/usr/bin/env node
/**
 * Sphere yedeğinin şifresini çöz (bağımlılık yok — yalnız Node 18+).
 *
 *   BACKUP_ENCRYPTION_KEY='...' node decrypt-backup.mjs sphere_20261023_123.sql.gz.enc sphere.sql.gz
 *
 * Sonra:  gunzip sphere.sql.gz   →  sphere.sql  (psql ile geri yüklenir; bkz. BACKUP.md)
 * Dosya biçimi: "SPHBK1" | salt(16) | iv(12) | AES-256-GCM şifreli veri | etiket(16)
 */
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { createDecipheriv, scryptSync } from "node:crypto";
import { pipeline } from "node:stream/promises";

const [, , inPath, outPath] = process.argv;
const pass = process.env.BACKUP_ENCRYPTION_KEY;
if (!inPath || !outPath || !pass) {
  console.error("Kullanım: BACKUP_ENCRYPTION_KEY='...' node decrypt-backup.mjs <girdi.enc> <çıktı.sql.gz>");
  process.exit(1);
}
const MAGIC = Buffer.from("SPHBK1");
const fh = await fs.open(inPath, "r");
try {
  const { size } = await fh.stat();
  const header = Buffer.alloc(MAGIC.length + 16 + 12);
  await fh.read(header, 0, header.length, 0);
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Bu bir Sphere yedek dosyası değil");
  const salt = header.subarray(MAGIC.length, MAGIC.length + 16);
  const iv = header.subarray(MAGIC.length + 16);
  const tag = Buffer.alloc(16);
  await fh.read(tag, 0, 16, size - 16);
  const key = scryptSync(pass, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  await pipeline(createReadStream(inPath, { start: header.length, end: size - 17 }), d, createWriteStream(outPath));
  console.log(`✓ Çözüldü: ${outPath}`);
} catch (e) {
  console.error("✗ Çözülemedi:", e.message.includes("authenticate") ? "anahtar yanlış ya da dosya bozuk" : e.message);
  process.exit(1);
} finally {
  await fh.close();
}
