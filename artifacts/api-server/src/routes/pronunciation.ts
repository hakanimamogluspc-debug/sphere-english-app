import { Router } from "express";
import OpenAI from "openai";
import { authMiddleware } from "../middlewares/auth.js";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ALLOWED_VOICES = ["nova", "onyx", "shimmer", "echo", "alloy", "fable"] as const;
type Voice = typeof ALLOWED_VOICES[number];

router.post("/pronunciation/analyze", authMiddleware, async (req, res) => {
  try {
    const { text, voice = "nova" } = req.body as { text: string; voice?: Voice };
    const safeVoice: Voice = ALLOWED_VOICES.includes(voice as Voice) ? (voice as Voice) : "nova";
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is empty" });
    }

    // GPT analysis — concise prompt for speed
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a business English coach. Analyze the student's spoken English and return JSON:
- hasErrors: boolean
- corrected: string (grammatically correct version, or original if correct)
- feedback: string (1 sentence in Turkish, encouraging. Explain the error if any.)
- score: number (0-100)

Be concise. For single words, check spelling/pronunciation context.`,
        },
        {
          role: "user",
          content: `"${text.trim()}"`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 200,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    // TTS: only speak the corrected sentence clearly (short = fast)
    const ttsText = result.corrected || text.trim();

    const ttsResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: safeVoice,
      input: ttsText,
      speed: 0.85,
    });

    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    const audioBase64 = audioBuffer.toString("base64");

    return res.json({
      hasErrors: result.hasErrors ?? false,
      corrected: result.corrected || text.trim(),
      original: text.trim(),
      feedback: result.feedback || "",
      score: result.score ?? 100,
      audioBase64,
    });
  } catch (err: any) {
    console.error("Pronunciation analyze error:", err?.message || err);
    return res.status(500).json({ error: "Analysis failed" });
  }
});

export default router;
