import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { resetDb, closeDb } from "./helpers.js";
import { getLiveEbookCatalog } from "../lib/live-ebook-catalog.js";

const tag = Date.now();
const ids: number[] = [];

beforeAll(async () => {
  await resetDb();
  for (const [title, category, price, active] of [
    [`Katalog Sunum ${tag}`, "Beceri Kitapları", 249, true],
    [`Katalog Havacılık ${tag}`, "Sektörel İngilizce", 299, true],
    [`Katalog Pasif ${tag}`, null, 99, false],
  ] as const) {
    const r = await pool.query(
      `INSERT INTO ebooks (slug, title, description, author, price_try, category, is_active)
       VALUES ($1, $2, 'x', 'Sphere English', $3, $4, $5) RETURNING id`,
      [`katalog-${ids.length}-${tag}`, title, price, category, active],
    );
    ids.push(r.rows[0].id);
  }
});
afterAll(async () => {
  await pool.query(`DELETE FROM ebooks WHERE id = ANY($1::int[])`, [ids]).catch(() => {});
  await closeDb();
});

describe("botlar için canlı e-kitap kataloğu", () => {
  it("aktif kitapları güncel fiyat ve linkle, www ile aynı gruplarla listeler; pasif kitabı göstermez", async () => {
    const text = await getLiveEbookCatalog();
    expect(text).toContain("CANLI");
    expect(text).toContain(`Katalog Sunum ${tag}`);
    expect(text).toMatch(/Katalog Sunum \d+" — ₺249/);
    expect(text).toContain("### Beceri Kitapları");
    expect(text).toContain("### Sektörel İngilizce");
    expect(text).toContain(`https://www.sphereenglish.com/e-kitaplar/katalog-0-${tag}`);
    expect(text).not.toContain(`Katalog Pasif ${tag}`);
    expect(text).toContain("uydurma");
  });
});
