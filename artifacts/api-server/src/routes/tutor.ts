import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import {
  aiTutorConversationsTable,
  aiTutorMessagesTable,
  aiTutorMemoryTable,
  type TutorMemoryFact,
  type TutorMessageMeta,
  usersTable,
} from "@workspace/db/schema";
import { and, desc, eq, asc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth.js";
import { randomUUID } from "crypto";

const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY ortam değişkeni ayarlanmamış");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

const FOCUS_AREAS = ["grammar", "vocabulary", "conversation", "exam_prep", "business", "free"] as const;
const FOCUS_LABELS: Record<string, string> = {
  grammar: "Dilbilgisi",
  vocabulary: "Kelime",
  conversation: "Sohbet & Akıcılık",
  exam_prep: "Sınav Hazırlığı",
  business: "İş İngilizcesi",
  free: "Serbest",
};

async function getOrCreateMemory(userId: number) {
  const [existing] = await db.select().from(aiTutorMemoryTable).where(eq(aiTutorMemoryTable.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(aiTutorMemoryTable).values({ userId, facts: [] }).returning();
  return created;
}

async function getUserContext(userId: number): Promise<string> {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return "";
    return `Student profile: name=${user.fullName || user.email}, CEFR=${(user as any).cefrLevel || "unknown"}, role=${user.role}.`;
  } catch {
    return "";
  }
}

function buildSystemPrompt(opts: {
  focusArea: string | null;
  facts: TutorMemoryFact[];
  userContext: string;
}): string {
  const focusLabel = opts.focusArea ? FOCUS_LABELS[opts.focusArea] || opts.focusArea : "Genel İngilizce";

  const factsBlock = opts.facts.length > 0
    ? opts.facts.map((f) => `  - [${f.category}] ${f.fact}`).join("\n")
    : "  (no persistent facts yet)";

  return `You are "Sphere", a warm, encouraging, and highly skilled Turkish-speaking English tutor inside the Sphere English LMS.

YOUR PERSONALITY:
- Warm, supportive, never condescending. You celebrate small wins.
- Patient, but you push the student to grow.
- Bilingual: you fluently switch between Turkish and English. Use Turkish for explanations and English for practice/examples by default.
- You sound like a real teacher, not a robot. Use natural Turkish.

CURRENT FOCUS: ${focusLabel}

STUDENT CONTEXT (from their profile):
${opts.userContext || "(no profile data available)"}

PERSISTENT FACTS YOU REMEMBER ABOUT THIS STUDENT (across all sessions):
${factsBlock}

YOUR JOB:
1. Answer their question or continue the lesson naturally.
2. Adjust difficulty to their level. If they're A2, use simpler English; if B2+, more sophisticated.
3. When you correct mistakes, be kind. Show the corrected version, then briefly explain in Turkish.
4. Mix English (for the actual language practice) and Turkish (for grammar explanations, encouragement, meta-comments).
5. Keep responses concise — 2-5 short paragraphs max. Don't info-dump.
6. End with a small follow-up question or actionable practice prompt to keep momentum.
7. NEVER mention you are an AI / language model. You are "Sphere", their tutor.

OUTPUT FORMAT:
Plain text. You can use Markdown for emphasis, lists, and code-blocks for example sentences.
Use this convention for corrections: **❌ Original** → **✅ Corrected** — then a short Turkish explanation.

Begin teaching now in your warm, helpful style.`;
}

// ── Routes ─────────────────────────────────────────────

// GET /tutor/conversations — list
router.get("/tutor/conversations", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const rows = await db
      .select()
      .from(aiTutorConversationsTable)
      .where(and(eq(aiTutorConversationsTable.userId, userId), eq(aiTutorConversationsTable.archived, false)))
      .orderBy(desc(aiTutorConversationsTable.lastMessageAt))
      .limit(50);
    return res.json({ conversations: rows });
  } catch (err: any) {
    console.error("List tutor conversations error:", err?.message || err);
    return res.status(500).json({ error: "Sohbetler alınamadı." });
  }
});

// POST /tutor/conversations — create new
router.post("/tutor/conversations", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const focusArea = (FOCUS_AREAS as readonly string[]).includes(req.body?.focusArea)
      ? (req.body.focusArea as string)
      : "free";
    const title = String(req.body?.title || "Yeni Sohbet").slice(0, 200);
    const [convo] = await db
      .insert(aiTutorConversationsTable)
      .values({ userId, title, focusArea })
      .returning();
    return res.json({ conversation: convo });
  } catch (err: any) {
    console.error("Create tutor convo error:", err?.message || err);
    return res.status(500).json({ error: "Sohbet oluşturulamadı." });
  }
});

// GET /tutor/conversations/:id
router.get("/tutor/conversations/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id." });
    const [convo] = await db
      .select()
      .from(aiTutorConversationsTable)
      .where(and(eq(aiTutorConversationsTable.id, id), eq(aiTutorConversationsTable.userId, userId)))
      .limit(1);
    if (!convo) return res.status(404).json({ error: "Sohbet bulunamadı." });
    const messages = await db
      .select()
      .from(aiTutorMessagesTable)
      .where(eq(aiTutorMessagesTable.conversationId, id))
      .orderBy(asc(aiTutorMessagesTable.createdAt));
    return res.json({ conversation: convo, messages });
  } catch (err: any) {
    console.error("Get tutor convo error:", err?.message || err);
    return res.status(500).json({ error: "Sohbet alınamadı." });
  }
});

// DELETE /tutor/conversations/:id
router.delete("/tutor/conversations/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Geçersiz id." });
    await db
      .delete(aiTutorConversationsTable)
      .where(and(eq(aiTutorConversationsTable.id, id), eq(aiTutorConversationsTable.userId, userId)));
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("Delete tutor convo error:", err?.message || err);
    return res.status(500).json({ error: "Sohbet silinemedi." });
  }
});

// POST /tutor/conversations/:id/message — send a user message, get assistant reply
router.post("/tutor/conversations/:id/message", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const convoId = parseInt(req.params.id, 10);
    if (!Number.isFinite(convoId)) return res.status(400).json({ error: "Geçersiz id." });
    const userMessage = String(req.body?.message || "").slice(0, 4000).trim();
    if (!userMessage) return res.status(400).json({ error: "Mesaj boş olamaz." });

    const [convo] = await db
      .select()
      .from(aiTutorConversationsTable)
      .where(and(eq(aiTutorConversationsTable.id, convoId), eq(aiTutorConversationsTable.userId, userId)))
      .limit(1);
    if (!convo) return res.status(404).json({ error: "Sohbet bulunamadı." });

    const [savedUserMsg] = await db
      .insert(aiTutorMessagesTable)
      .values({ conversationId: convoId, role: "user", content: userMessage })
      .returning();

    const memory = await getOrCreateMemory(userId);
    const userContext = await getUserContext(userId);

    const sysPrompt = buildSystemPrompt({
      focusArea: convo.focusArea || "free",
      facts: memory.facts,
      userContext,
    });

    // Load only the last 20 messages (DB-side limit) and reverse chronologically
    const recentDesc = await db
      .select()
      .from(aiTutorMessagesTable)
      .where(eq(aiTutorMessagesTable.conversationId, convoId))
      .orderBy(desc(aiTutorMessagesTable.createdAt))
      .limit(20);
    const trimmed = recentDesc.slice().reverse();

    const messages: any[] = [
      { role: "system", content: sysPrompt },
      ...trimmed.map((m) => ({ role: m.role, content: m.content })),
    ];

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 700,
    });

    const replyText = completion.choices[0]?.message?.content?.trim() || "(cevap üretilemedi)";

    const [savedAssistantMsg] = await db
      .insert(aiTutorMessagesTable)
      .values({ conversationId: convoId, role: "assistant", content: replyText, meta: null })
      .returning();

    // Update conversation lastMessageAt + maybe title
    let newTitle = convo.title;
    if (convo.title === "Yeni Sohbet") {
      // Auto-generate from first user message: first 6 words
      const words = userMessage.split(/\s+/).slice(0, 7).join(" ");
      newTitle = words.length > 0 ? words.slice(0, 60) : "Yeni Sohbet";
    }
    await db
      .update(aiTutorConversationsTable)
      .set({ lastMessageAt: new Date(), title: newTitle })
      .where(eq(aiTutorConversationsTable.id, convoId));

    // Async: extract memory facts (don't block response)
    extractAndStoreFacts(userId, userMessage, replyText).catch((err) => {
      console.warn("memory extraction failed:", err?.message || err);
    });

    return res.json({
      userMessage: savedUserMsg,
      assistantMessage: savedAssistantMsg,
      conversationTitle: newTitle,
    });
  } catch (err: any) {
    console.error("Tutor message error:", err?.message || err);
    return res.status(500).json({ error: "Mesaj gönderilemedi." });
  }
});

// GET /tutor/memory
router.get("/tutor/memory", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const memory = await getOrCreateMemory(userId);
    return res.json({ memory });
  } catch (err: any) {
    console.error("Get tutor memory error:", err?.message || err);
    return res.status(500).json({ error: "Hafıza alınamadı." });
  }
});

// DELETE /tutor/memory/:factId — remove a single fact
router.delete("/tutor/memory/:factId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as number;
    const factId = String(req.params.factId);
    const memory = await getOrCreateMemory(userId);
    const newFacts = memory.facts.filter((f) => f.id !== factId);
    const [updated] = await db
      .update(aiTutorMemoryTable)
      .set({ facts: newFacts, updatedAt: new Date() })
      .where(eq(aiTutorMemoryTable.userId, userId))
      .returning();
    return res.json({ memory: updated });
  } catch (err: any) {
    console.error("Delete tutor fact error:", err?.message || err);
    return res.status(500).json({ error: "Hafıza güncellenemedi." });
  }
});

// Background memory extraction
async function extractAndStoreFacts(userId: number, userMessage: string, assistantReply: string) {
  try {
    const memory = await getOrCreateMemory(userId);
    if (memory.facts.length >= 25) return; // cap memory size

    const sys = `You extract durable, factual snippets from a tutoring conversation that should be remembered LONG-TERM about the student.

Examples of GOOD facts:
  - "Hedefi: TOEFL 100+ skoru için hazırlanmak"
  - "İş İngilizcesinde sunum yapmaya odaklanıyor"
  - "Past perfect tense'i karıştırıyor"
  - "Mühendislik alanında çalışıyor"
  - "Akademik kelime hazinesini geliştirmek istiyor"

Bad facts (DO NOT extract):
  - Greetings, ephemeral feelings ("today I'm tired"), one-off jokes
  - Things the assistant said about itself

Look at this user message and assistant reply. Extract 0-2 NEW durable facts (Turkish, max 1 sentence each).

Return STRICT JSON:
{ "facts": [ { "category": "level"|"goal"|"weakness"|"strength"|"interest"|"context", "fact": "<short Turkish>" } ] }

If nothing meaningful, return { "facts": [] }.`;

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `User: ${userMessage}\n\nAssistant: ${assistantReply}` },
      ],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    const newFacts: TutorMemoryFact[] = (parsed.facts || [])
      .filter((f: any) => f && typeof f.fact === "string" && f.fact.trim().length > 0)
      .slice(0, 2)
      .map((f: any) => ({
        id: randomUUID(),
        category: ["level", "goal", "weakness", "strength", "interest", "context"].includes(f.category)
          ? f.category
          : "context",
        fact: String(f.fact).trim().slice(0, 200),
        createdAt: new Date().toISOString(),
      }));

    if (newFacts.length === 0) return;

    // Dedupe by lowercase fact text
    const existing = new Set(memory.facts.map((f) => f.fact.toLowerCase().trim()));
    const dedup = newFacts.filter((f) => !existing.has(f.fact.toLowerCase().trim()));
    if (dedup.length === 0) return;

    const merged = [...memory.facts, ...dedup].slice(-25);
    await db
      .update(aiTutorMemoryTable)
      .set({ facts: merged, updatedAt: new Date() })
      .where(eq(aiTutorMemoryTable.userId, userId));
  } catch (e) {
    // silent
  }
}

export default router;
