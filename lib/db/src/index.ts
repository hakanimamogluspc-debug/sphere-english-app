import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "[db] WARNING: DATABASE_URL is not set. Database queries will fail.",
  );
}

// Uygulama çekirdek sayısı kadar worker + 1 primary süreç açar; her birinin kendi havuzu var.
// CPX32 (4 çekirdek) → 5 süreç × 15 = 75 bağlantı → PostgreSQL varsayılan limiti (100) altında,
// www (Payload) ve yönetim bağlantılarına da pay kalır. (Eskiden 25 idi: 5 × 25 = 125 > 100.)
// İstenirse DB_POOL_MAX ile değiştirilebilir.
export const pool = new Pool({
  connectionString: connectionString ?? "postgresql://localhost/placeholder",
  max: Number(process.env.DB_POOL_MAX) || 15,
  idleTimeoutMillis: 30_000, // 30sn boşta kalan bağlantıyı kapat
  connectionTimeoutMillis: 5_000, // 5sn bağlantı kurulamazsa hata ver
});

// Boştaki bir bağlantı veritabanı tarafından kapatılırsa (DB yeniden başlatma, sunucu kapanışı,
// bakım) pg bu hatayı havuz üzerinden yayar. Dinleyici yoksa Node süreci ÇÖKER.
// Havuz bozuk bağlantıyı zaten atıyor ve sonraki sorguda yenisini açıyor — sadece kaydet.
pool.on("error", (err) => {
  console.warn("[db] boştaki bağlantı koptu (havuz yenisini açacak):", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
export { VOCAB_WORDS } from "./seeds/vocab-words";
