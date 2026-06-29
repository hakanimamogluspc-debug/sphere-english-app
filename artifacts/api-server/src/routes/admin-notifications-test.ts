import { Router, type IRouter, Response } from "express";
import { authMiddleware, requireRole, AuthRequest } from "../middlewares/auth";

/**
 * Admin bildirim sistemi test endpoint'i.
 * Tüm event tiplerini birer örnek mail olarak admin'lere atar.
 *
 * Endpoint:
 *   POST /api/admin/notifications/test
 *   { eventType?: "all" | "teacher" | "partner" | "contact" | "subscription" | "ebook" }
 *
 *   Default: "all" — her event tipinden 1 örnek gönderir.
 *
 *   Response:
 *   { ok: true, recipientCount: N, recipients: [...], eventsSent: [...] }
 */

const router: IRouter = Router();

router.post(
  "/admin/notifications/test",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const eventType = (req.body?.eventType ?? "all") as string;
      const recipients = (process.env.ADMIN_NOTIFICATION_EMAILS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.includes("@"));

      if (recipients.length === 0) {
        return res.status(400).json({
          ok: false,
          error:
            "ADMIN_NOTIFICATION_EMAILS env değişkeni tanımlı değil. Easypanel api-server servisinde bu değişkeni ekle (virgüllü liste).",
          hint: "ADMIN_NOTIFICATION_EMAILS=admin@sphereenglish.com,baska@email.com",
        });
      }

      const m = await import("../lib/admin-notifications.js");
      const eventsSent: string[] = [];

      const ts = new Date().toLocaleString("tr-TR");

      if (eventType === "all" || eventType === "teacher") {
        await m.notifyNewTeacherApplication({
          applicationId: 999999,
          fullName: `[TEST] Ali Yılmaz · ${ts}`,
          email: "test.teacher@example.com",
          experience: "3-5 Yıl",
          englishLevel: "Advanced",
        });
        eventsSent.push("teacher");
      }

      if (eventType === "all" || eventType === "partner") {
        await m.notifyNewPartnerApplication({
          affiliateId: 999999,
          fullName: `[TEST] Ayşe Demir · ${ts}`,
          email: "test.partner@example.com",
          promotionPlan: "Instagram + YouTube içerikleri ile dil eğitimi içeriği üretiyorum.",
        });
        eventsSent.push("partner");
      }

      if (eventType === "all" || eventType === "contact") {
        await m.notifyNewContactMessage({
          name: `[TEST] Mehmet Can · ${ts}`,
          email: "test.contact@example.com",
          subject: "Kurumsal teklif talebi",
          message:
            "Merhaba, şirketimiz için 50 çalışana yönelik kurumsal İngilizce eğitimi düşünüyoruz. Detaylı bilgi alabilir miyim?",
        });
        eventsSent.push("contact");
      }

      if (eventType === "all" || eventType === "subscription") {
        await m.notifyNewSubscription({
          userEmail: "test.subscriber@example.com",
          planLabel: "[TEST] Pro Aylık",
          amountTl: 299,
          couponCode: "HOSGELDIN10",
          partnerCode: null,
        });
        eventsSent.push("subscription");
      }

      if (eventType === "all" || eventType === "ebook") {
        await m.notifyNewEbookPurchase({
          purchaseId: 999999,
          buyerEmail: "test.ebook@example.com",
          ebookTitle: "[TEST] İş İngilizcesi Sözlüğü",
          amountTl: 99,
        });
        eventsSent.push("ebook");
      }

      return res.json({
        ok: true,
        recipientCount: recipients.length,
        recipients,
        eventsSent,
        message: `${eventsSent.length} test bildirim, ${recipients.length} alıcıya gönderildi`,
      });
    } catch (e: any) {
      console.error("[admin/notifications/test] HATA:", e?.message);
      return res.status(500).json({ ok: false, error: e?.message });
    }
  },
);

export default router;
