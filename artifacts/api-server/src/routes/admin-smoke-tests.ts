import { Router, type IRouter, Request, Response } from "express";
import { authMiddleware, requireRole, AuthRequest } from "../middlewares/auth";

/**
 * Admin Smoke Tests
 *
 * Kritik endpoint'leri tek bir çağrıyla test edip sonuçları döner.
 * Sunucu kendi kendine localhost üzerinden istek atar — gerçek middleware
 * stack'inden geçer, en realistik test.
 *
 * Endpoints:
 *   POST /api/admin/smoke-tests/run         — tüm testleri çalıştır
 *   GET  /api/admin/smoke-tests/definitions — test tanımlarını listele
 */

type TestDef = {
  id: string;
  category: string;
  name: string;
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  /** true → admin'in Authorization header'ını forward et */
  auth?: boolean;
  /** request body (JSON) */
  body?: any;
  /**
   * Bu status code beklenir. Belirtilmezse 200/204 (2xx) kabul edilir.
   * Bazı public validate çağrıları 200 ok:false döner — bu da pass sayılır.
   */
  expectedStatus?: number;
};

const TESTS: TestDef[] = [
  // ── Public (auth yok) ────────────────────────────────────────────────
  { id: "healthz", category: "Public", name: "Health check", method: "GET", path: "/api/healthz" },
  { id: "openapi-json", category: "Public", name: "OpenAPI spec JSON", method: "GET", path: "/api/openapi.json" },

  // ── Chatbot ──────────────────────────────────────────────────────────
  {
    id: "chat-public",
    category: "Chatbot",
    name: "Chat POST (sahte mesaj)",
    method: "POST",
    path: "/api/chat",
    body: {
      messages: [{ role: "user", content: "smoke test" }],
      sessionId: "smoke-" + Date.now(),
    },
  },

  // ── Kupon ────────────────────────────────────────────────────────────
  {
    id: "coupon-validate-invalid",
    category: "Kupon",
    name: "Validate (geçersiz kod — 200 ok:false beklenir)",
    method: "POST",
    path: "/api/coupons/validate",
    body: { code: "ZZZZINVALID", scope: "ebook", amountKurus: 10000 },
  },

  // ── Affiliate ────────────────────────────────────────────────────────
  {
    id: "affiliate-track",
    category: "Affiliate",
    name: "Track click (geçersiz kod — 404 beklenir)",
    method: "POST",
    path: "/api/affiliate/track",
    body: { code: "ZZZZINVALID", landingPath: "/abonelik" },
    expectedStatus: 404,
  },
  {
    id: "affiliate-code-invalid",
    category: "Affiliate",
    name: "Lookup code (geçersiz — 404 beklenir)",
    method: "GET",
    path: "/api/affiliate/code/ZZZZINVALID",
    expectedStatus: 404,
  },

  // ── Auth ─────────────────────────────────────────────────────────────
  { id: "auth-me", category: "Auth", name: "Auth me", method: "GET", path: "/api/auth/me", auth: true },

  // ── User-level ───────────────────────────────────────────────────────
  { id: "notifications", category: "Kullanıcı", name: "Notifications list", method: "GET", path: "/api/notifications", auth: true },
  { id: "dashboard", category: "Kullanıcı", name: "Dashboard", method: "GET", path: "/api/dashboard", auth: true },

  // ── Admin listings ───────────────────────────────────────────────────
  { id: "admin-coupons", category: "Admin Listings", name: "Kuponlar", method: "GET", path: "/api/admin/coupons", auth: true },
  { id: "admin-affiliates", category: "Admin Listings", name: "Affiliates", method: "GET", path: "/api/admin/affiliates", auth: true },
  { id: "admin-teacher-apps", category: "Admin Listings", name: "Eğitmen başvuruları", method: "GET", path: "/api/admin/teacher-applications", auth: true },
  { id: "admin-ebooks", category: "Admin Listings", name: "E-kitaplar", method: "GET", path: "/api/admin/ebooks", auth: true },
  { id: "admin-ebook-purchases", category: "Admin Listings", name: "E-kitap satışları", method: "GET", path: "/api/admin/ebook-purchases", auth: true },
  { id: "admin-subscriptions", category: "Admin Listings", name: "Abonelikler", method: "GET", path: "/api/admin/subscriptions", auth: true },
  { id: "admin-backups", category: "Admin Listings", name: "DB yedekleri", method: "GET", path: "/api/admin/backups", auth: true },
  { id: "admin-chatbot-faqs", category: "Admin Listings", name: "Chatbot FAQ", method: "GET", path: "/api/admin/chatbot/faqs", auth: true },
  { id: "admin-ig-threads", category: "Admin Listings", name: "Instagram thread'leri", method: "GET", path: "/api/admin/instagram/threads", auth: true },
  { id: "admin-wa-threads", category: "Admin Listings", name: "WhatsApp thread'leri", method: "GET", path: "/api/admin/whatsapp/threads", auth: true },

  // ── Analytics ────────────────────────────────────────────────────────
  { id: "an-overview", category: "Analytics", name: "Web — overview", method: "GET", path: "/api/admin/analytics/web/overview", auth: true },
  { id: "an-geo", category: "Analytics", name: "Web — geo", method: "GET", path: "/api/admin/analytics/web/geo", auth: true },
  { id: "an-recent", category: "Analytics", name: "Web — recent", method: "GET", path: "/api/admin/analytics/web/recent", auth: true },
  { id: "an-top", category: "Analytics", name: "Web — top pages", method: "GET", path: "/api/admin/analytics/web/top-pages", auth: true },
  { id: "an-devices", category: "Analytics", name: "Web — devices", method: "GET", path: "/api/admin/analytics/web/devices", auth: true },
  { id: "an-referrers", category: "Analytics", name: "Web — referrers", method: "GET", path: "/api/admin/analytics/web/referrers", auth: true },
];

const router: IRouter = Router();

router.get(
  "/admin/smoke-tests/definitions",
  authMiddleware,
  requireRole("admin"),
  (_req: Request, res: Response) => {
    return res.json({
      tests: TESTS.map((t) => ({
        id: t.id,
        category: t.category,
        name: t.name,
        method: t.method,
        path: t.path,
        requiresAuth: !!t.auth,
      })),
    });
  },
);

router.post(
  "/admin/smoke-tests/run",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const port = process.env.PORT ?? "3000";
    const baseUrl = `http://localhost:${port}`;

    const results: any[] = [];

    for (const test of TESTS) {
      const start = Date.now();
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (test.auth && authHeader) headers.Authorization = authHeader;

        const r = await fetch(`${baseUrl}${test.path}`, {
          method: test.method,
          headers,
          body: test.body ? JSON.stringify(test.body) : undefined,
        });

        const elapsed = Date.now() - start;
        const expected = test.expectedStatus;
        const ok = expected != null ? r.status === expected : r.status >= 200 && r.status < 300;

        // Hata varsa body'yi göster, başarılıysa gizle
        let bodyPreview: any = null;
        if (!ok) {
          const text = await r.text();
          try {
            bodyPreview = JSON.parse(text);
          } catch {
            bodyPreview = text.slice(0, 500);
          }
        }

        results.push({
          id: test.id,
          category: test.category,
          name: test.name,
          method: test.method,
          path: test.path,
          ok,
          status: r.status,
          responseTime: elapsed,
          expectedStatus: expected,
          body: bodyPreview,
        });
      } catch (e: any) {
        const elapsed = Date.now() - start;
        results.push({
          id: test.id,
          category: test.category,
          name: test.name,
          method: test.method,
          path: test.path,
          ok: false,
          status: 0,
          responseTime: elapsed,
          error: e?.message ?? "Bilinmeyen hata (fetch failed)",
        });
      }
    }

    const total = results.length;
    const passed = results.filter((r) => r.ok).length;
    const failed = total - passed;
    const avgResponseTime = total > 0 ? Math.round(results.reduce((s, r) => s + r.responseTime, 0) / total) : 0;

    return res.json({
      summary: { total, passed, failed, avgResponseTime, runAt: new Date().toISOString() },
      results,
    });
  },
);

export default router;
