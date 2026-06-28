/**
 * Chatbot Backend API
 *
 * Public endpoint'ler (CORS açık, www.sphereenglish.com'dan çağrılır):
 *   POST /api/chat                  → Mesaj gönder, AI yanıtı al
 *   POST /api/chat/lead             → Sohbetten lead capture
 *
 * Admin endpoint'leri (auth gerekli):
 *   GET  /api/admin/chatbot/faqs    → FAQ listesi
 *   POST /api/admin/chatbot/faqs    → Yeni FAQ
 *   PATCH /api/admin/chatbot/faqs/:id → Güncelle
 *   DELETE /api/admin/chatbot/faqs/:id → Sil
 *   GET  /api/admin/chatbot/conversations → Konuşma geçmişi
 */

import { Router, type Request, type Response } from "express";
import {
  db,
  chatbotFaqsTable,
  chatbotConversationsTable,
  contactLeadsTable,
  type ChatMessage,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import OpenAI from "openai";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";
import { buildSystemPrompt } from "../lib/chatbot-knowledge.js";

const router = Router();

const MODEL = process.env.CHATBOT_MODEL ?? "gpt-4o-mini";
const MAX_HISTORY_MESSAGES = 12; // son 12 mesaj context'e alınır (token tasarrufu)

// CORS handler — sphere-www'den çağrı için
function setChatbotCors(res: Response, req: Request) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    "https://www.sphereenglish.com",
    "https://sphereenglish.com",
    "http://localhost:3000",
    "http://localhost:3001",
  ];
  if (origin && allowedOrigins.some((o) => origin === o || origin.endsWith(".sphereenglish.com"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Chat-Session");
    res.setHeader("Access-Control-Allow-Credentials", "false");
    res.setHeader("Vary", "Origin");
  }
}

// ─── POST /api/chat ─────────────────────────────────────────────────────
router.options("/chat", (req, res) => {
  setChatbotCors(res, req);
  res.status(204).end();
});

router.post("/chat", async (req: Request, res: Response) => {
  console.info(`[chatbot] /chat POST geldi — path=${req.path} originalUrl=${req.originalUrl}`);
  setChatbotCors(res, req);

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Chatbot şu an aktif değil (OPENAI_API_KEY yok)." });
    }

    const { messages, sessionId, pageUrl } = req.body as {
      messages: ChatMessage[];
      sessionId: string;
      pageUrl?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Mesaj listesi boş olamaz." });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "Oturum ID gerekli." });
    }

    // Spam koruması — bir oturumda max 50 mesaj
    if (messages.length > 50) {
      return res.status(429).json({ error: "Oturum sınırı doldu, sayfayı yenileyin." });
    }

    // Son kullanıcı mesajını al
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) {
      return res.status(400).json({ error: "Kullanıcı mesajı bulunamadı." });
    }

    // Aktif FAQ'leri çek (tablo yoksa boş array ile devam et)
    let faqs: any[] = [];
    try {
      faqs = await db
        .select({
          question: chatbotFaqsTable.question,
          answer: chatbotFaqsTable.answer,
          category: chatbotFaqsTable.category,
        })
        .from(chatbotFaqsTable)
        .where(eq(chatbotFaqsTable.isActive, true))
        .orderBy(desc(chatbotFaqsTable.sortOrder))
        .limit(50);
    } catch (faqErr: any) {
      console.warn("[chatbot] FAQ select fail (boş ile devam):", faqErr?.message);
    }

    const systemPrompt = buildSystemPrompt(faqs);

    // OpenAI'e gönder (sadece son N mesajı tut)
    const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Sadece user/assistant rollerini geçir (system prompt zaten yukarıda)
    const conversationMessages = recentMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: String(m.content ?? "").slice(0, 4000),
      }));

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      max_tokens: 350,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationMessages,
      ],
    });

    let responseText = completion.choices[0]?.message?.content ?? "";

    // Lead capture etiketi var mı kontrol et
    const captureMatch = responseText.match(/<CAPTURE_LEAD>(\{[^}]+\})<\/CAPTURE_LEAD>/);
    let capturedLead: { email?: string; name?: string; company?: string } | null = null;
    if (captureMatch) {
      try {
        capturedLead = JSON.parse(captureMatch[1]);
        responseText = responseText.replace(/<CAPTURE_LEAD>[^<]+<\/CAPTURE_LEAD>/, "").trim();
      } catch {
        // parse hatası — etiketi temizle, devam et
        responseText = responseText.replace(/<CAPTURE_LEAD>[^<]+<\/CAPTURE_LEAD>/, "").trim();
      }
    }

    // Fallback — AI etiketi atmadıysa, kullanıcı mesajında email arayıp yakala
    if (!capturedLead?.email) {
      const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/;
      // Tüm user mesajlarını dolaş (son mesaj genelde email içerir ama emin olmak için hepsini tara)
      for (const m of messages) {
        if (m.role !== "user") continue;
        const match = String(m.content || "").match(emailRegex);
        if (match) {
          capturedLead = { email: match[1] };
          // İsim/firma bilgisi de aynı mesajda varsa basit heuristik (isteğe bağlı)
          break;
        }
      }
    }

    // Konuşmayı kaydet (upsert by sessionId)
    const fullMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: responseText, timestamp: new Date().toISOString() },
    ];

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
    const userAgent = (req.headers["user-agent"] as string) || "";
    const referrer = (req.headers["referer"] as string) || "";

    await db
      .insert(chatbotConversationsTable)
      .values({
        sessionId,
        messages: fullMessages as any,
        messageCount: fullMessages.length,
        userAgent,
        ip,
        referrer,
        pageUrl,
        lastMessageAt: new Date(),
      })
      .onConflictDoUpdate({
        target: chatbotConversationsTable.sessionId,
        set: {
          messages: fullMessages as any,
          messageCount: fullMessages.length,
          lastMessageAt: new Date(),
        },
      })
      .catch((err) => {
        // sessionId unique index yoksa fallback — sadece insert
        console.warn("[chatbot] conversation upsert error:", err?.message);
      });

    // Lead yakalandıysa contact_leads'e yaz
    if (capturedLead?.email) {
      await db
        .insert(contactLeadsTable)
        .values({
          name: capturedLead.name || capturedLead.email.split("@")[0],
          email: capturedLead.email,
          company: capturedLead.company || null,
          message: `Chatbot sohbeti üzerinden gelen lead.\n\nSon mesaj: ${lastUserMsg.content.slice(0, 500)}`,
          source: "chatbot",
        })
        .catch((err) => console.warn("[chatbot] lead capture error:", err?.message));

      // Konuşmaya lead bilgisini de işle
      await db
        .update(chatbotConversationsTable)
        .set({
          leadEmail: capturedLead.email,
          leadName: capturedLead.name ?? null,
          leadCompany: capturedLead.company ?? null,
          leadCapturedAt: new Date(),
        })
        .where(eq(chatbotConversationsTable.sessionId, sessionId))
        .catch(() => {});
    }

    return res.json({
      message: responseText,
      capturedLead: capturedLead?.email ? { email: capturedLead.email } : null,
    });
  } catch (err: any) {
    console.error("[chatbot] CRASH:", err?.message, err?.stack?.slice(0, 500));
    // Sentry'ye gönder (varsa)
    try {
      const { captureException } = await import("../lib/sentry.js");
      captureException(err, { route: "/chat", body: req.body });
    } catch {}
    setChatbotCors(res, req);
    return res.status(500).json({ error: "Asistan şu an cevap veremiyor. Lütfen birazdan tekrar deneyin." });
  }
});

// ─── POST /api/chat/lead — manuel lead form ────────────────────────────
router.options("/chat/lead", (req, res) => {
  setChatbotCors(res, req);
  res.status(204).end();
});

router.post("/chat/lead", async (req: Request, res: Response) => {
  setChatbotCors(res, req);
  try {
    const { name, email, company, message, sessionId } = req.body as {
      name?: string;
      email: string;
      company?: string;
      message?: string;
      sessionId?: string;
    };

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Geçerli bir email gerekli." });
    }

    await db.insert(contactLeadsTable).values({
      name: name || email.split("@")[0],
      email,
      company: company || null,
      message: message || "Chatbot widget üzerinden gelen lead.",
      source: "chatbot",
    });

    if (sessionId) {
      await db
        .update(chatbotConversationsTable)
        .set({
          leadEmail: email,
          leadName: name ?? null,
          leadCompany: company ?? null,
          leadCapturedAt: new Date(),
        })
        .where(eq(chatbotConversationsTable.sessionId, sessionId))
        .catch(() => {});
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[chatbot] lead error:", err);
    return res.status(500).json({ error: "Kayıt edilemedi." });
  }
});

// ─── Admin: FAQ CRUD ───────────────────────────────────────────────────
router.get(
  "/admin/chatbot/faqs",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const faqs = await db
        .select()
        .from(chatbotFaqsTable)
        .orderBy(desc(chatbotFaqsTable.sortOrder), desc(chatbotFaqsTable.id));
      return res.json(faqs);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "FAQ'ler alınamadı." });
    }
  },
);

router.post(
  "/admin/chatbot/faqs",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { category, question, answer, keywords, isActive, sortOrder } = req.body;
      if (!question?.trim() || !answer?.trim()) {
        return res.status(400).json({ error: "Soru ve cevap zorunludur." });
      }
      const [faq] = await db
        .insert(chatbotFaqsTable)
        .values({
          category: category?.trim() || null,
          question: question.trim(),
          answer: answer.trim(),
          keywords: keywords?.trim() || null,
          isActive: isActive !== false,
          sortOrder: Number(sortOrder) || 0,
          createdBy: req.userId,
        })
        .returning();
      return res.json(faq);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Oluşturulamadı." });
    }
  },
);

router.patch(
  "/admin/chatbot/faqs/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { category, question, answer, keywords, isActive, sortOrder } = req.body;
      const update: Record<string, any> = { updatedAt: new Date() };
      if (category !== undefined) update.category = category?.trim() || null;
      if (question !== undefined) update.question = question.trim();
      if (answer !== undefined) update.answer = answer.trim();
      if (keywords !== undefined) update.keywords = keywords?.trim() || null;
      if (isActive !== undefined) update.isActive = !!isActive;
      if (sortOrder !== undefined) update.sortOrder = Number(sortOrder) || 0;
      await db.update(chatbotFaqsTable).set(update).where(eq(chatbotFaqsTable.id, id));
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Güncelleme başarısız." });
    }
  },
);

router.delete(
  "/admin/chatbot/faqs/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      await db.delete(chatbotFaqsTable).where(eq(chatbotFaqsTable.id, id));
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Silme başarısız." });
    }
  },
);

// ─── Admin: Konuşma geçmişi ─────────────────────────────────────────────
router.get(
  "/admin/chatbot/conversations",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { hasLead, page = "1" } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limit = 50;

      const filters: any[] = [];
      if (hasLead === "true") {
        filters.push(sql`${chatbotConversationsTable.leadEmail} IS NOT NULL`);
      }
      const where = filters.length > 0 ? and(...filters) : undefined;

      const items = await db
        .select()
        .from(chatbotConversationsTable)
        .where(where)
        .orderBy(desc(chatbotConversationsTable.startedAt))
        .limit(limit)
        .offset((pageNum - 1) * limit);

      return res.json({ items, page: pageNum });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? "Konuşmalar alınamadı." });
    }
  },
);

export default router;
