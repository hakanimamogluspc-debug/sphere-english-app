import { Router } from "express";
import OpenAI from "openai";
import { authMiddleware } from "../middlewares/auth.js";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/pronunciation/analyze", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body as { text: string };
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is empty" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an English pronunciation and grammar coach. Analyze the student's spoken English.

Return a JSON object with these fields:
- hasErrors: boolean (true if there are grammar or word-choice errors)
- corrected: string (the corrected version, or original if correct)
- feedback: string (brief, encouraging explanation in Turkish, max 2 sentences. If correct, praise them warmly)
- errorType: string ("grammar" | "vocabulary" | "none")
- score: number (0-100, pronunciation/grammar score)

Be encouraging and supportive. If the text is correct, praise specific aspects.
Focus on business English context since this is a corporate English learning platform.`,
        },
        {
          role: "user",
          content: `Student said: "${text.trim()}"`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    const speakText = result.hasErrors
      ? `Good try! The correct way to say this is: "${result.corrected}". ${result.feedback}`
      : `Excellent! "${result.corrected}" — ${result.feedback}`;

    const ttsResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: speakText,
      speed: 0.9,
    });

    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    const audioBase64 = audioBuffer.toString("base64");

    return res.json({
      ...result,
      original: text.trim(),
      audioBase64,
      speakText,
    });
  } catch (err) {
    console.error("Pronunciation analyze error:", err);
    return res.status(500).json({ error: "Analysis failed" });
  }
});

export default router;
