/**
 * Yardım Merkezi (help center)
 *
 * Public (auth yok — www ve uygulama giriş öncesi de kullanır):
 *   GET  /api/help/categories                 → aktif kategoriler + yayımlı makale sayısı
 *   GET  /api/help/articles?category=&q=&audience=&limit=
 *   GET  /api/help/articles/:slug             → makale (view_count +1)
 *   POST /api/help/articles/:slug/feedback    { helpful: boolean, comment? }
 *   GET  /api/help/suggest?q=                 → destek formu için ilk 5 öneri (log'lanır)
 *
 * Admin:
 *   GET    /api/admin/help/overview           → istatistik + son aramalar
 *   GET    /api/admin/help/categories | POST | PATCH /:id | DELETE /:id
 *   GET    /api/admin/help/articles  | POST | PATCH /:id | DELETE /:id
 *
 * İçerik Markdown (body_md). Arama: ILIKE + to_tsvector('simple') birlikte;
 * Türkçe kök bulma yok ama başlık/özet/etiket eşleşmesi pratikte yeterli.
 */
import { Router, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { pool } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const AUDIENCES = new Set(["all", "student", "corporate"]);

function slugify(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}

function voterHash(req: Request, userId?: number): string {
  const base = userId ? `u:${userId}` : `ip:${req.ip ?? ""}|${req.headers["user-agent"] ?? ""}`;
  return createHash("sha256").update(base).digest("hex").slice(0, 64);
}

const ARTICLE_COLS = `
  a.id, a.slug, a.title, a.summary, a.audience, a.tags, a.sort_order AS "sortOrder",
  a.view_count AS "viewCount", a.helpful_yes AS "helpfulYes", a.helpful_no AS "helpfulNo",
  a.updated_at AS "updatedAt",
  c.slug AS "categorySlug", c.title AS "categoryTitle", c.icon AS "categoryIcon"`;

/** Arama: başlık/özet/etiket ILIKE (ağırlıklı) + tam metin */
function searchClause(paramIdx: number) {
  return {
    where: `(
      a.title ILIKE $${paramIdx} OR a.summary ILIKE $${paramIdx}
      OR EXISTS (SELECT 1 FROM unnest(a.tags) t WHERE t ILIKE $${paramIdx})
      OR to_tsvector('simple', coalesce(a.title,'') || ' ' || coalesce(a.summary,'') || ' ' || coalesce(a.body_md,''))
         @@ plainto_tsquery('simple', $${paramIdx + 1})
    )`,
    rank: `(
      (a.title ILIKE $${paramIdx})::int * 4
      + (EXISTS (SELECT 1 FROM unnest(a.tags) t WHERE t ILIKE $${paramIdx}))::int * 3
      + (a.summary ILIKE $${paramIdx})::int * 2
      + ts_rank(to_tsvector('simple', coalesce(a.title,'') || ' ' || coalesce(a.body_md,'')), plainto_tsquery('simple', $${paramIdx + 1}))
    )`,
  };
}

// ─── PUBLIC ─────────────────────────────────────────────────────────────────

router.get("/help/categories", async (_req: Request, res: Response) => {
  const { rows } = await pool.query(`
    SELECT c.id, c.slug, c.title, c.description, c.icon, c.audience, c.sort_order AS "sortOrder",
           COUNT(a.id) FILTER (WHERE a.is_published)::int AS "articleCount"
    FROM help_categories c
    LEFT JOIN help_articles a ON a.category_id = c.id
    WHERE c.is_active = true
    GROUP BY c.id
    ORDER BY c.sort_order, c.title
  `);
  res.set("Cache-Control", "public, max-age=300");
  res.json({ categories: rows });
});

router.get("/help/articles", async (req: Request, res: Response) => {
  const category = String(req.query.category ?? "").trim();
  const q = String(req.query.q ?? "").trim().slice(0, 120);
  const audience = String(req.query.audience ?? "").trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "100"), 10) || 100, 1), 200);

  const params: unknown[] = [];
  const where: string[] = ["a.is_published = true", "(c.id IS NULL OR c.is_active = true)"];
  if (category) { params.push(category); where.push(`c.slug = $${params.length}`); }
  if (audience && AUDIENCES.has(audience) && audience !== "all") {
    params.push(audience); where.push(`a.audience IN ('all', $${params.length})`);
  }
  let orderBy = "c.sort_order, a.sort_order, a.title";
  if (q) {
    params.push(`%${q}%`, q);
    const sc = searchClause(params.length - 1);
    where.push(sc.where);
    orderBy = `${sc.rank} DESC, a.sort_order`;
  }
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT ${ARTICLE_COLS}
       FROM help_articles a LEFT JOIN help_categories c ON c.id = a.category_id
      WHERE ${where.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT $${params.length}`,
    params,
  );
  if (q) {
    void pool.query(`INSERT INTO help_search_log (query, result_count, source) VALUES ($1, $2, $3)`, [
      q, rows.length, String(req.query.source ?? "app").slice(0, 20),
    ]).catch(() => {});
  }
  res.json({ articles: rows, query: q || null });
});

router.get("/help/suggest", async (req: Request, res: Response) => {
  const q = String(req.query.q ?? "").trim().slice(0, 120);
  if (q.length < 3) return res.json({ articles: [] });
  const sc = searchClause(1);
  const { rows } = await pool.query(
    `SELECT a.slug, a.title, a.summary, c.title AS "categoryTitle"
       FROM help_articles a LEFT JOIN help_categories c ON c.id = a.category_id
      WHERE a.is_published = true AND ${sc.where}
      ORDER BY ${sc.rank} DESC
      LIMIT 5`,
    [`%${q}%`, q],
  );
  void pool.query(`INSERT INTO help_search_log (query, result_count, source) VALUES ($1, $2, 'support-form')`, [q, rows.length]).catch(() => {});
  res.json({ articles: rows });
});

router.get("/help/articles/:slug", async (req: Request, res: Response) => {
  const slug = String(req.params.slug);
  const { rows } = await pool.query(
    `SELECT ${ARTICLE_COLS}, a.body_md AS "bodyMd"
       FROM help_articles a LEFT JOIN help_categories c ON c.id = a.category_id
      WHERE a.slug = $1 AND a.is_published = true
      LIMIT 1`,
    [slug],
  );
  if (!rows[0]) return res.status(404).json({ error: "Makale bulunamadı" });
  void pool.query(`UPDATE help_articles SET view_count = view_count + 1 WHERE id = $1`, [rows[0].id]).catch(() => {});

  // Aynı kategoriden "ilgili" 4 makale
  const { rows: related } = await pool.query(
    `SELECT a.slug, a.title, a.summary
       FROM help_articles a
      WHERE a.is_published = true AND a.id <> $1 AND a.category_id IS NOT DISTINCT FROM (SELECT category_id FROM help_articles WHERE id = $1)
      ORDER BY a.sort_order LIMIT 4`,
    [rows[0].id],
  );
  res.json({ article: rows[0], related });
});

router.post("/help/articles/:slug/feedback", async (req: Request, res: Response) => {
  const slug = String(req.params.slug);
  const helpful = req.body?.helpful;
  if (typeof helpful !== "boolean") return res.status(400).json({ error: "helpful (boolean) gerekli" });
  const comment = typeof req.body?.comment === "string" ? req.body.comment.trim().slice(0, 1000) : null;

  const { rows } = await pool.query(`SELECT id FROM help_articles WHERE slug = $1 AND is_published = true`, [slug]);
  if (!rows[0]) return res.status(404).json({ error: "Makale bulunamadı" });
  const articleId = rows[0].id;

  // Giriş yapmışsa userId ile, değilse ip+ua hash'i ile tekilleştir (opsiyonel auth)
  let userId: number | undefined;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const jwt = await import("jsonwebtoken");
      const payload = jwt.default.verify(auth.slice(7), process.env.JWT_SECRET as string) as { userId?: number };
      userId = payload.userId;
    } catch { /* anonim say */ }
  }
  const hash = voterHash(req, userId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const prev = await client.query(`SELECT helpful FROM help_article_feedback WHERE article_id = $1 AND voter_hash = $2`, [articleId, hash]);
    if (prev.rows[0]) {
      const old = prev.rows[0].helpful as boolean;
      if (old !== helpful) {
        await client.query(`UPDATE help_article_feedback SET helpful = $3, comment = COALESCE($4, comment), created_at = NOW() WHERE article_id = $1 AND voter_hash = $2`, [articleId, hash, helpful, comment]);
        await client.query(
          `UPDATE help_articles SET helpful_yes = helpful_yes + $2, helpful_no = helpful_no + $3 WHERE id = $1`,
          [articleId, helpful ? 1 : -1, helpful ? -1 : 1],
        );
      } else if (comment) {
        await client.query(`UPDATE help_article_feedback SET comment = $3 WHERE article_id = $1 AND voter_hash = $2`, [articleId, hash, comment]);
      }
    } else {
      await client.query(
        `INSERT INTO help_article_feedback (article_id, user_id, voter_hash, helpful, comment) VALUES ($1,$2,$3,$4,$5)`,
        [articleId, userId ?? null, hash, helpful, comment],
      );
      await client.query(
        `UPDATE help_articles SET ${helpful ? "helpful_yes = helpful_yes + 1" : "helpful_no = helpful_no + 1"} WHERE id = $1`,
        [articleId],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  const { rows: cnt } = await pool.query(`SELECT helpful_yes AS "helpfulYes", helpful_no AS "helpfulNo" FROM help_articles WHERE id = $1`, [articleId]);
  res.json({ ok: true, ...cnt[0] });
});

// ─── ADMIN ──────────────────────────────────────────────────────────────────

const admin = [authMiddleware, requireRole("admin")] as const;

router.get("/admin/help/overview", ...admin, async (_req: AuthRequest, res: Response) => {
  const [{ rows: totals }, { rows: top }, { rows: worst }, { rows: searches }, { rows: zero }] = await Promise.all([
    pool.query(`
      SELECT COUNT(*)::int AS "articles",
             COUNT(*) FILTER (WHERE is_published)::int AS "published",
             COALESCE(SUM(view_count),0)::int AS "views",
             COALESCE(SUM(helpful_yes),0)::int AS "helpfulYes",
             COALESCE(SUM(helpful_no),0)::int AS "helpfulNo"
        FROM help_articles`),
    pool.query(`SELECT slug, title, view_count AS "viewCount", helpful_yes AS "helpfulYes", helpful_no AS "helpfulNo" FROM help_articles WHERE is_published ORDER BY view_count DESC LIMIT 8`),
    pool.query(`SELECT slug, title, helpful_yes AS "helpfulYes", helpful_no AS "helpfulNo" FROM help_articles WHERE is_published AND (helpful_yes + helpful_no) >= 3 ORDER BY (helpful_no::float / NULLIF(helpful_yes + helpful_no,0)) DESC LIMIT 5`),
    pool.query(`SELECT query, COUNT(*)::int AS n, MAX(created_at) AS "lastAt" FROM help_search_log WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY query ORDER BY n DESC LIMIT 15`),
    pool.query(`SELECT query, COUNT(*)::int AS n FROM help_search_log WHERE result_count = 0 AND created_at > NOW() - INTERVAL '30 days' GROUP BY query ORDER BY n DESC LIMIT 10`),
  ]);
  res.json({ totals: totals[0], topArticles: top, lowRated: worst, topSearches: searches, zeroResultSearches: zero });
});

router.get("/admin/help/categories", ...admin, async (_req: AuthRequest, res: Response) => {
  const { rows } = await pool.query(`
    SELECT c.*, c.sort_order AS "sortOrder", c.is_active AS "isActive",
           COUNT(a.id)::int AS "articleCount"
      FROM help_categories c LEFT JOIN help_articles a ON a.category_id = c.id
     GROUP BY c.id ORDER BY c.sort_order, c.title`);
  res.json({ categories: rows });
});

router.post("/admin/help/categories", ...admin, async (req: AuthRequest, res: Response) => {
  const { title, description, icon, audience, sortOrder } = req.body ?? {};
  if (!title || String(title).trim().length < 2) return res.status(400).json({ error: "Başlık gerekli" });
  const slug = slugify(req.body?.slug || title);
  const { rows } = await pool.query(
    `INSERT INTO help_categories (slug, title, description, icon, audience, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [slug, String(title).trim(), description ?? null, icon ?? null, AUDIENCES.has(audience) ? audience : "all", Number(sortOrder) || 100],
  );
  res.status(201).json({ category: rows[0] });
});

router.patch("/admin/help/categories/:id", ...admin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const b = req.body ?? {};
  const { rows } = await pool.query(
    `UPDATE help_categories SET
       title = COALESCE($2, title), description = COALESCE($3, description), icon = COALESCE($4, icon),
       audience = COALESCE($5, audience), sort_order = COALESCE($6, sort_order), is_active = COALESCE($7, is_active),
       slug = COALESCE($8, slug), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, b.title ?? null, b.description ?? null, b.icon ?? null, AUDIENCES.has(b.audience) ? b.audience : null,
     b.sortOrder != null ? Number(b.sortOrder) : null, typeof b.isActive === "boolean" ? b.isActive : null,
     b.slug ? slugify(b.slug) : null],
  );
  if (!rows[0]) return res.status(404).json({ error: "Kategori bulunamadı" });
  res.json({ category: rows[0] });
});

router.delete("/admin/help/categories/:id", ...admin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM help_articles WHERE category_id = $1`, [id]);
  if (rows[0].n > 0) return res.status(400).json({ error: `Kategoride ${rows[0].n} makale var; önce taşıyın.` });
  await pool.query(`DELETE FROM help_categories WHERE id = $1`, [id]);
  res.json({ ok: true });
});

router.get("/admin/help/articles", ...admin, async (req: AuthRequest, res: Response) => {
  const q = String(req.query.q ?? "").trim();
  const params: unknown[] = [];
  let where = "TRUE";
  if (q) { params.push(`%${q}%`); where = `(a.title ILIKE $1 OR a.summary ILIKE $1 OR a.slug ILIKE $1)`; }
  const { rows } = await pool.query(
    `SELECT a.id, a.slug, a.title, a.summary, a.audience, a.tags, a.is_published AS "isPublished",
            a.sort_order AS "sortOrder", a.view_count AS "viewCount", a.helpful_yes AS "helpfulYes", a.helpful_no AS "helpfulNo",
            a.category_id AS "categoryId", c.title AS "categoryTitle", a.updated_at AS "updatedAt"
       FROM help_articles a LEFT JOIN help_categories c ON c.id = a.category_id
      WHERE ${where}
      ORDER BY c.sort_order NULLS LAST, a.sort_order, a.title`,
    params,
  );
  res.json({ articles: rows });
});

router.get("/admin/help/articles/:id", ...admin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const { rows } = await pool.query(
    `SELECT a.*, a.body_md AS "bodyMd", a.category_id AS "categoryId", a.is_published AS "isPublished", a.sort_order AS "sortOrder"
       FROM help_articles a WHERE a.id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: "Makale bulunamadı" });
  const { rows: fb } = await pool.query(
    `SELECT helpful, comment, created_at AS "createdAt" FROM help_article_feedback WHERE article_id = $1 AND comment IS NOT NULL ORDER BY created_at DESC LIMIT 20`, [id]);
  res.json({ article: rows[0], comments: fb });
});

router.post("/admin/help/articles", ...admin, async (req: AuthRequest, res: Response) => {
  const b = req.body ?? {};
  if (!b.title || String(b.title).trim().length < 3) return res.status(400).json({ error: "Başlık gerekli" });
  const slug = slugify(b.slug || b.title);
  const tags = Array.isArray(b.tags) ? b.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 20) : [];
  try {
    const { rows } = await pool.query(
      `INSERT INTO help_articles (category_id, slug, title, summary, body_md, audience, tags, is_published, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, slug`,
      [b.categoryId ?? null, slug, String(b.title).trim(), String(b.summary ?? "").trim(), String(b.bodyMd ?? ""),
       AUDIENCES.has(b.audience) ? b.audience : "all", tags, !!b.isPublished, Number(b.sortOrder) || 100],
    );
    res.status(201).json({ article: rows[0] });
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "Bu slug zaten kullanılıyor" });
    throw e;
  }
});

router.patch("/admin/help/articles/:id", ...admin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const b = req.body ?? {};
  const tags = Array.isArray(b.tags) ? b.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 20) : null;
  try {
    const { rows } = await pool.query(
      `UPDATE help_articles SET
         category_id = CASE WHEN $2::boolean THEN $3 ELSE category_id END,
         slug = COALESCE($4, slug), title = COALESCE($5, title), summary = COALESCE($6, summary),
         body_md = COALESCE($7, body_md), audience = COALESCE($8, audience), tags = COALESCE($9, tags),
         is_published = COALESCE($10, is_published), sort_order = COALESCE($11, sort_order), updated_at = NOW()
       WHERE id = $1 RETURNING id, slug`,
      [id, "categoryId" in b, b.categoryId ?? null, b.slug ? slugify(b.slug) : null, b.title ?? null, b.summary ?? null,
       b.bodyMd ?? null, AUDIENCES.has(b.audience) ? b.audience : null, tags,
       typeof b.isPublished === "boolean" ? b.isPublished : null, b.sortOrder != null ? Number(b.sortOrder) : null],
    );
    if (!rows[0]) return res.status(404).json({ error: "Makale bulunamadı" });
    res.json({ article: rows[0] });
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ error: "Bu slug zaten kullanılıyor" });
    throw e;
  }
});

router.delete("/admin/help/articles/:id", ...admin, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  await pool.query(`DELETE FROM help_articles WHERE id = $1`, [id]);
  res.json({ ok: true });
});

export default router;
