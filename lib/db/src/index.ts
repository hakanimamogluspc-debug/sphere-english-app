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

// CPX22 = 3 worker × 25 = 75 bağlantı → PostgreSQL varsayılan limiti (100) altında güvenli
// CPX32 = 4 worker × 25 = 100 — sınırda ama kabul edilebilir
// Sunucu yükseltildiğinde bu değer de artırılabilir
export const pool = new Pool({
  connectionString: connectionString ?? "postgresql://localhost/placeholder",
  max: 25,
  idleTimeoutMillis: 30_000, // 30sn boşta kalan bağlantıyı kapat
  connectionTimeoutMillis: 5_000, // 5sn bağlantı kurulamazsa hata ver
});

export const db = drizzle(pool, { schema });

export * from "./schema";
export { VOCAB_WORDS } from "./seeds/vocab-words";
