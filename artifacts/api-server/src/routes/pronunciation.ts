import { Router, Request, Response } from "express";
import OpenAI from "openai";
import multer from "multer";
import { authMiddleware } from "../middlewares/auth.js";
import { Readable } from "stream";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ALLOWED_VOICES = ["nova", "onyx", "shimmer", "echo", "alloy", "fable"] as const;
type Voice = typeof ALLOWED_VOICES[number];

function normalizeWord(w: string) {
  return w.toLowerCase().replace(/[^a-z']/g, "");
}

function comparePronunciation(webSpeech: string, whisper: string): string[] {
  const ws = webSpeech.trim().split(/\s+/).map(normalizeWord).filter(Boolean);
  const wh = whisper.trim().split(/\s+/).map(normalizeWord).filter(Boolean);
  const mispronounced: string[] = [];
  const minLen = Math.min(ws.length, wh.length);
  for (let i = 0; i < minLen; i++) {
    if (ws[i] !== wh[i] && ws[i].length > 0 && wh[i].length > 0) {
      mispronounced.push(ws[i]);
    }
  }
  return mispronounced;
}

router.post(
  "/pronunciation/analyze",
  authMiddleware,
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      const webSpeechText: string = (req.body.text || "").trim();
      const voice = req.body.voice as Voice;
      const safeVoice: Voice = ALLOWED_VOICES.includes(voice) ? voice : "nova";

      if (!webSpeechText) {
        return res.status(400).json({ error: "Text is empty" });
      }

      // --- Whisper transcription (if audio provided) ---
      let whisperText = webSpeechText;
      let mispronounced: string[] = [];

      if (req.file && req.file.buffer.length > 1000) {
        try {
          const audioFile = new File([req.file.buffer], "audio.webm", {
            type: req.file.mimetype || "audio/webm",
          });
          const whisperRes = await openai.audio.transcriptions.create({
            model: "whisper-1",
            file: audioFile,
            language: "en",
            temperature: 0,
          });
          whisperText = whisperRes.text.trim();
          mispronounced = comparePronunciation(webSpeechText, whisperText);
        } catch (e: any) {
          console.warn("Whisper error (ignoring):", e?.message);
        }
      }

      // --- GPT grammar + pronunciation analysis ---
      const pronunciationNote =
        mispronounced.length > 0
          ? `Whisper (ham ses analizi) şu kelimeleri farklı duydu: ${mispronounced.join(", ")}. Bu kelimeler telaffuz sorunu yaşanmış olabilir.`
          : "";

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Sen İngilizce telaffuz ve gramer koçusun. Öğrenci İngilizce bir cümle söyledi.
Web Speech API duyduğu: "{{webSpeech}}"
Whisper (ham ses analizi) duyduğu: "{{whisper}}"
${pronunciationNote}

Aşağıdaki JSON'u döndür:
- hasErrors: boolean (gramer VEYA telaffuz hatası varsa true)
- corrected: string (doğru hali)
- feedback: string (1-2 cümle Türkçe geri bildirim. Telaffuz sorunu varsa hangi kelimede olduğunu söyle. İyi telaffuz için teşvik et.)
- score: number (0-100. Telaffuz hatası -10 puan, gramer hatası -15 puan uygula. Her şey doğruysa 100.)
- pronunciationIssues: string[] (telaffuz sorunu olan kelimeler, yoksa boş dizi)

Dikkat: Eğer Web Speech ile Whisper farklı şeyler duyduysa bu ciddi bir telaffuz sorununa işaret eder, mutlaka belirt.
Çok katı ol — Türk öğrencilerin sıkça yaptığı hataları (th sesi, -ed ekleri, -s ekleri, ch/sh sesi) aktif olarak kontrol et.`,
          },
          {
            role: "user",
            content: `Web Speech: "${webSpeechText}"\nWhisper: "${whisperText}"`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 300,
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");

      // TTS
      const ttsText = result.corrected || webSpeechText;
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
        corrected: result.corrected || webSpeechText,
        original: webSpeechText,
        whisperText,
        feedback: result.feedback || "",
        score: result.score ?? 100,
        pronunciationIssues: result.pronunciationIssues ?? [],
        audioBase64,
      });
    } catch (err: any) {
      console.error("Pronunciation analyze error:", err?.message || err);
      return res.status(500).json({ error: "Analysis failed" });
    }
  }
);

export default router;
