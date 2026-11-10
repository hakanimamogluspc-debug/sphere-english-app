import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PDFDocument } from "pdf-lib";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, createAdmin } from "./helpers.js";
import { setExtractorForTests, splitPdf, runPracticeExtraction, claimExtractionJob, type ExtractedItem } from "../lib/ebook-practice-extract.js";

let auth: Record<string, string> = {};
let ebookId = 0;
const calls: Array<{ from: number; to: number; lastUnit: string }> = [];

async function makePdf(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return Buffer.from(await doc.save());
}

// Sahte model: ilk parçada ünite 1, ikinci parçada başlıksız (önceki üniteye düşmeli) + tekrar eden kalıp
const fake = async (_pdf: Buffer, ctx: { from: number; to: number; lastUnit: string }): Promise<ExtractedItem[]> => {
  calls.push({ from: ctx.from, to: ctx.to, lastUnit: ctx.lastUnit });
  if (ctx.from === 1) return [
    { unit: "Ünite 1: Toplantıyı Açmak", kind: "pattern", en: "Let's get the ball rolling.", tr: "Hadi başlayalım.", explanation: "Toplantıyı başlatırken.", example_en: "Right, let's get the ball rolling.", example_tr: "Pekâlâ, başlayalım." },
    { unit: "Ünite 1: Toplantıyı Açmak", kind: "term", en: "agenda", tr: "gündem", explanation: null, example_en: null, example_tr: null },
  ];
  if (ctx.from === 7) return [
    // Aynı ünite BÜYÜK HARFLE gelirse ayrı ünite açılmamalı
    { unit: "ÜNİTE 2: SÖZ ALMAK", kind: "term", en: "minutes", tr: "toplantı tutanağı", explanation: null, example_en: null, example_tr: null },
  ];
  return [
    { unit: "", kind: "term", en: "action item", tr: "yapılacak iş", explanation: null, example_en: null, example_tr: null },
    { unit: "", kind: "pattern", en: "Let’s get the ball rolling", tr: "tekrar", explanation: null, example_en: null, example_tr: null },
    { unit: "Ünite 2: Söz Almak", kind: "pattern", en: "If I could just come in here…", tr: "Burada araya girebilirsem…", explanation: null, example_en: null, example_tr: null },
    { unit: "Ünite 2", kind: "bogus" as any, en: "x", tr: "", explanation: null, example_en: null, example_tr: null },
  ];
};

beforeAll(async () => {
  await resetDb();
  auth = { Authorization: `Bearer ${(await createAdmin()).token}` };
  ebookId = (await pool.query(
    `INSERT INTO ebooks (slug, title, description, author, price_try) VALUES ($1, 'Pratik Testi', 'x', 'Sphere English', 399) RETURNING id`,
    [`pratik-${Date.now()}`],
  )).rows[0].id;
  await pool.query(
    `INSERT INTO ebook_assets (ebook_id, asset_type, filename, mime_type, size_bytes, data_base64)
     VALUES ($1, 'full', 'kitap.pdf', 'application/pdf', 1, $2)`,
    [ebookId, (await makePdf(9)).toString("base64")],
  );
  setExtractorForTests(fake);
});
afterAll(async () => {
  setExtractorForTests(null);
  await pool.query(`DELETE FROM ebooks WHERE id = $1`, [ebookId]).catch(() => {});
  await closeDb();
});

describe("kitap pratikleri: çıkarım", () => {
  it("PDF sayfa parçalarına bölünür", async () => {
    const parts = await splitPdf(await makePdf(9), 6);
    expect(parts.map((p) => [p.from, p.to])).toEqual([[1, 6], [7, 9]]);
    expect((await splitPdf(await makePdf(9))).map((p) => p.from)).toEqual([1, 4, 7]);
  });

  it("öğeler taslak olarak kaydedilir; başlıksız öğe önceki üniteye düşer; tekrar ve geçersiz tür atlanır", async () => {
    expect(await claimExtractionJob(ebookId)).toBe(true);
    expect(await claimExtractionJob(ebookId)).toBe(false); // aynı anda ikinci iş yok
    const r = await runPracticeExtraction(ebookId);
    expect(r.items).toBe(5);
    expect(calls[1].lastUnit).toBe("Ünite 1: Toplantıyı Açmak");

    const d = (await api().get(`/api/admin/ebook-practice/${ebookId}`).set(auth)).body;
    expect(d.job.status).toBe("done");
    expect(d.items.every((i: any) => i.status === "draft")).toBe(true);
    const ai = d.items.find((i: any) => i.en === "action item");
    expect(ai.unitTitle).toBe("Ünite 1: Toplantıyı Açmak");
    expect(ai.unitOrder).toBe(1);
    expect(d.items.find((i: any) => i.en.startsWith("If I could")).unitOrder).toBe(2);
    const minutes = d.items.find((i: any) => i.en === "minutes");
    expect(minutes.unitOrder).toBe(2);
    expect(minutes.unitTitle).toBe("Ünite 2: Söz Almak");
  });

  it("onaylı öğeler yeniden çıkarımda korunur ve çoğaltılmaz", async () => {
    const d = (await api().get(`/api/admin/ebook-practice/${ebookId}`).set(auth)).body;
    const agenda = d.items.find((i: any) => i.en === "agenda");
    await api().patch(`/api/admin/ebook-practice/items/${agenda.id}`).set(auth).send({ status: "approved", tr: "toplantı gündemi" });

    await claimExtractionJob(ebookId);
    await runPracticeExtraction(ebookId);
    const after = (await api().get(`/api/admin/ebook-practice/${ebookId}`).set(auth)).body.items;
    const agendas = after.filter((i: any) => i.en === "agenda");
    expect(agendas).toHaveLength(1);
    expect(agendas[0].status).toBe("approved");
    expect(agendas[0].tr).toBe("toplantı gündemi");
    expect(after).toHaveLength(5);
  });

  it("'Eksikleri tara' taslakları silmez, yalnızca yeni öğe ekler", async () => {
    const before = (await api().get(`/api/admin/ebook-practice/${ebookId}`).set(auth)).body.items;
    const draftIds = before.filter((i: any) => i.status === "draft").map((i: any) => i.id).sort();
    setExtractorForTests(async (pdf, ctx) => {
      const base = await fake(pdf, ctx);
      return ctx.from === 1 ? [...base, { unit: "", kind: "term", en: "stakeholder", tr: "paydaş", explanation: null, example_en: null, example_tr: null }] : base;
    });
    await claimExtractionJob(ebookId);
    await runPracticeExtraction(ebookId, { append: true });
    setExtractorForTests(fake);
    const after = (await api().get(`/api/admin/ebook-practice/${ebookId}`).set(auth)).body.items;
    expect(after).toHaveLength(6);
    expect(after.filter((i: any) => draftIds.includes(i.id)).map((i: any) => i.id).sort()).toEqual(draftIds);
    expect(after.find((i: any) => i.en === "stakeholder").unitOrder).toBe(1);
  });
});

describe("kitap pratikleri: admin onay ve yayın", () => {
  it("onaysız kitap yayına alınamaz; ünite toplu onayı; yayına alma; admin dışı erişim yok", async () => {
    await pool.query(`UPDATE ebook_practice_items SET status = 'draft' WHERE ebook_id = $1`, [ebookId]);
    expect((await api().post(`/api/admin/ebook-practice/${ebookId}/publish`).set(auth).send({ published: true })).status).toBe(400);

    const b = await api().post(`/api/admin/ebook-practice/${ebookId}/bulk-status`).set(auth).send({ status: "approved", unitOrder: 1 });
    expect(b.body.updated).toBe(4);
    expect((await api().patch(`/api/admin/ebook-practice/items/999999`).set(auth).send({ status: "approved" })).status).toBe(404);
    const anyItem = (await pool.query(`SELECT id FROM ebook_practice_items WHERE ebook_id = $1 LIMIT 1`, [ebookId])).rows[0].id;
    expect((await api().patch(`/api/admin/ebook-practice/items/${anyItem}`).set(auth).send({ en: "  " })).status).toBe(400);
    expect((await api().patch(`/api/admin/ebook-practice/items/${anyItem}`).set(auth).send({ status: "yayinda" })).status).toBe(400);

    expect((await api().post(`/api/admin/ebook-practice/${ebookId}/publish`).set(auth).send({ published: true })).status).toBe(200);
    const list = (await api().get(`/api/admin/ebook-practice`).set(auth)).body.books;
    expect(list.find((x: any) => x.id === ebookId).published).toBe(true);

    expect((await api().get(`/api/admin/ebook-practice`)).status).toBe(401);
    expect((await api().post(`/api/admin/ebook-practice/${ebookId}/extract`)).status).toBe(401);
  });
});
