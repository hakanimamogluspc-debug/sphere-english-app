import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import OpenAI from "openai";
import { db, quizzesTable, questionsTable } from "@workspace/db";
import { authMiddleware, requireRole, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OPENAI_API_KEY eksik");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// POST /teacher/quizzes/import — Word dosyasından quiz oluştur
router.post(
  "/teacher/quizzes/import",
  authMiddleware,
  requireRole("teacher", "admin"),
  upload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      const teacherId = req.userId!;
      const { title, level, passingScore, timeLimit, questionCount } = req.body;

      if (!title) {
        res.status(400).json({ error: "Quiz başlığı zorunludur" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "Word dosyası yüklenmedi" });
        return;
      }

      // 1. Word dosyasından metin çıkar
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      const text = result.value.trim();
      if (!text || text.length < 20) {
        res.status(400).json({ error: "Word dosyası okunamadı veya boş" });
        return;
      }

      // 2. OpenAI ile soru üret
      const count = Math.min(parseInt(questionCount) || 10, 20);
      const openai = getOpenAI();

      const systemPrompt = `Sen bir İngilizce dil testi uzmanısın. Verilen metin içeriğinden çoktan seçmeli sorular üretiyorsun.
      
Kurallar:
- Her soru "multiple_choice" tipinde olacak (4 seçenek)
- Seçenekler kısa ve net olacak
- Doğru cevap kesinlikle seçeneklerden biri olacak
- Sorular verilen metinle ilgili olacak (gramer, kelime, anlama)
- Türkçe soru yazma — sorular İngilizce olacak
- JSON dışında hiçbir şey yazma

Döndüreceğin format:
{
  "questions": [
    {
      "question": "soru metni",
      "options": ["A seçeneği", "B seçeneği", "C seçeneği", "D seçeneği"],
      "correctAnswer": "doğru seçenek (seçeneklerden biriyle birebir aynı)",
      "points": 10
    }
  ]
}`;

      const userPrompt = `Aşağıdaki İngilizce metin içeriğinden ${count} adet çoktan seçmeli soru üret:\n\n${text.slice(0, 4000)}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        res.status(500).json({ error: "AI yanıtı işlenemedi" });
        return;
      }

      const questions: any[] = parsed.questions || [];
      if (questions.length === 0) {
        res.status(500).json({ error: "AI soru üretemedi, dosyayı kontrol edin" });
        return;
      }

      // 3. Quiz ve soruları DB'ye kaydet
      const [quiz] = await db.insert(quizzesTable).values({
        title,
        level: level || null,
        teacherId,
        passingScore: parseInt(passingScore) || 70,
        timeLimit: timeLimit ? parseInt(timeLimit) : null,
        courseId: null,
      }).returning();

      const savedQuestions = await Promise.all(
        questions.map(async (q: any, i: number) => {
          const [saved] = await db.insert(questionsTable).values({
            quizId: quiz.id,
            type: "multiple_choice",
            question: q.question,
            options: Array.isArray(q.options) ? q.options : [],
            correctAnswer: q.correctAnswer,
            points: q.points || 10,
            order: i,
          }).returning();
          return saved;
        })
      );

      res.status(201).json({ ...quiz, questions: savedQuestions, questionsCount: savedQuestions.length });
    } catch (err: any) {
      if (err.message?.includes("OPENAI_API_KEY")) {
        res.status(500).json({ error: "OpenAI API anahtarı yapılandırılmamış" });
      } else {
        res.status(500).json({ error: err.message || "Quiz oluşturulamadı" });
      }
    }
  }
);

// GET /teacher/quizzes/import/preview — sadece soruları üret, kaydetme
router.post(
  "/teacher/quizzes/import/preview",
  authMiddleware,
  requireRole("teacher", "admin"),
  upload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) { res.status(400).json({ error: "Dosya yüklenmedi" }); return; }

      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      const text = result.value.trim();
      if (!text || text.length < 20) { res.status(400).json({ error: "Dosya boş veya okunamadı" }); return; }

      const count = Math.min(parseInt(req.body.questionCount) || 10, 20);
      const openai = getOpenAI();

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Sen bir İngilizce dil testi uzmanısın. Verilen metin içeriğinden çoktan seçmeli sorular üret. JSON formatında döndür: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":"...","points":10}]}`
          },
          { role: "user", content: `Şu metinden ${count} soru üret:\n\n${text.slice(0, 4000)}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
      res.json({ questions: parsed.questions || [], extractedText: text.slice(0, 500) });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Önizleme oluşturulamadı" });
    }
  }
);

export default router;
