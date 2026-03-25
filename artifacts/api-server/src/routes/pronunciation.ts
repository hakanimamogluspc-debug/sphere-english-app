import { Router, Request, Response } from "express";
import OpenAI from "openai";
import multer from "multer";
import { authMiddleware } from "../middlewares/auth.js";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ALLOWED_VOICES = ["nova", "onyx", "shimmer", "echo", "alloy", "fable"] as const;
type Voice = typeof ALLOWED_VOICES[number];

// ─── Whisper verbose — word-level confidence ───────────────────────────────

interface WhisperWord { word: string; start: number; end: number; probability: number }

async function transcribeVerbose(
  audioBuffer: Buffer,
  mimeType: string
): Promise<{ text: string; words: WhisperWord[] } | null> {
  try {
    const audioFile = new File([audioBuffer], "audio.webm", { type: mimeType || "audio/webm" });
    const res = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
      language: "en",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      temperature: 0,
    } as any);
    const data = res as any;
    const words: WhisperWord[] = (data.words || []).map((w: any) => ({
      word: (w.word || "").trim(),
      start: w.start ?? 0,
      end: w.end ?? 0,
      probability: w.probability ?? 1,
    }));
    return { text: (data.text || "").trim(), words };
  } catch (e: any) {
    console.warn("Whisper verbose error:", e?.message);
    return null;
  }
}

// ─── AssemblyAI — independent word-level confidence ───────────────────────

async function transcribeAssemblyAI(
  audioBuffer: Buffer,
  mimeType: string
): Promise<{ text: string; words: { text: string; confidence: number }[] } | null> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) return null;
  try {
    const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: { authorization: apiKey, "content-type": mimeType || "audio/webm" },
      body: audioBuffer,
    });
    if (!uploadRes.ok) return null;
    const { upload_url } = await uploadRes.json() as { upload_url: string };

    const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: { authorization: apiKey, "content-type": "application/json" },
      body: JSON.stringify({ audio_url: upload_url, language_code: "en", punctuate: false }),
    });
    if (!transcriptRes.ok) return null;
    const { id } = await transcriptRes.json() as { id: string };

    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const poll = await (await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { authorization: apiKey },
      })).json() as any;
      if (poll.status === "completed") {
        return {
          text: (poll.text || "").trim(),
          words: (poll.words || []).map((w: any) => ({ text: w.text as string, confidence: w.confidence as number })),
        };
      }
      if (poll.status === "error") return null;
    }
    return null;
  } catch (e: any) {
    console.warn("AssemblyAI error:", e?.message);
    return null;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────

router.post(
  "/pronunciation/analyze",
  authMiddleware,
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      const voice = req.body.voice as Voice;
      const safeVoice: Voice = ALLOWED_VOICES.includes(voice) ? voice : "nova";

      if (!req.file || req.file.buffer.length < 500) {
        return res.status(400).json({ error: "Ses kaydı bulunamadı." });
      }

      const mimeType = req.file.mimetype || "audio/webm";

      // ── Transcribe: Whisper + AssemblyAI in parallel ──
      const [whisperResult, assemblyResult] = await Promise.all([
        transcribeVerbose(req.file.buffer, mimeType),
        transcribeAssemblyAI(req.file.buffer, mimeType),
      ]);

      const whisperText = whisperResult?.text || "";
      const assemblyText = assemblyResult?.text || "";

      if (!whisperText && !assemblyText) {
        return res.status(400).json({ error: "Ses anlaşılamadı. Lütfen daha net konuşun." });
      }

      // ── Primary transcript: prefer Whisper ──
      const primaryText = whisperText || assemblyText;

      // ── Word-level scores from Whisper ──
      const whisperWords = whisperResult?.words || [];
      const wordScores = whisperWords
        .filter((w) => w.word.length > 0)
        .map((w) => ({
          word: w.word.toLowerCase().replace(/[^a-z']/g, ""),
          score: Math.round(w.probability * 100),
          ok: w.probability >= 0.80,
        }))
        .filter((w) => w.word.length > 0);

      // ── Pronunciation issues: Whisper low-confidence + Whisper vs AssemblyAI mismatch ──
      const lowConfidenceWords = whisperWords
        .filter((w) => w.probability < 0.80 && w.word.trim().length > 1)
        .map((w) => w.word.trim().toLowerCase());

      // Compare Whisper vs AssemblyAI transcripts for mismatch
      const wTokens = primaryText.toLowerCase().replace(/[^a-z\s']/g, "").split(/\s+/).filter(Boolean);
      const aTokens = assemblyText.toLowerCase().replace(/[^a-z\s']/g, "").split(/\s+/).filter(Boolean);
      const mismatched: string[] = [];
      if (assemblyText) {
        const minLen = Math.min(wTokens.length, aTokens.length);
        for (let i = 0; i < minLen; i++) {
          if (wTokens[i] !== aTokens[i]) mismatched.push(wTokens[i]);
        }
        // Words in Whisper not found in AssemblyAI
        wTokens.forEach((w) => { if (!aTokens.includes(w)) mismatched.push(w); });
      }

      const pronunciationIssues = Array.from(new Set([...lowConfidenceWords, ...mismatched]));

      // ── GPT: grammar + pronunciation feedback ──
      const whisperInfo = `Whisper transkripti: "${whisperText}"${
        whisperWords.length ? ` | Düşük güvenli kelimeler: ${lowConfidenceWords.join(", ") || "yok"}` : ""
      }`;
      const assemblyInfo = assemblyText ? `AssemblyAI transkripti: "${assemblyText}"` : "";
      const mismatchInfo = mismatched.length > 0 ? `İki sistem arası uyumsuz kelimeler: ${[...new Set(mismatched)].join(", ")}` : "";

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Sen İngilizce konuşma koçusun. Öğrencinin sesinden elde edilen transkriptleri analiz et.

ÖNEMLİ KISITLAMALAR:
- Bu bir KONUŞMA analizidir. Büyük/küçük harf, noktalama işareti ASLA hata sayılmaz.
- Sadece konuşmada duyulabilecek hatalar: yanlış kelime seçimi, eksik/fazla kelime, yanlış zaman kipi.
- Telaffuz hatası: iki sistem farklı kelime duymuşsa veya Whisper güveni düşükse.

${whisperInfo}
${assemblyInfo}
${mismatchInfo}

JSON döndür:
- hasErrors: boolean
- corrected: string (doğru hali, yoksa Whisper transkripsiyonunun kendisi)
- feedback: string (1-2 cümle Türkçe. Telaffuz sorunları varsa belirt, gramer hatasını açıkla.)
- score: number (0-100. Telaffuz sorunu -10, gramer hatası -15. Sorun yoksa 100.)
- pronunciationIssues: string[] (sorunlu kelimeler, yoksa boş dizi)`,
          },
          {
            role: "user",
            content: `Öğrenci şunu söyledi: "${primaryText}"`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 300,
      });

      const gptResult = JSON.parse(completion.choices[0].message.content || "{}");

      // ── TTS ──
      const ttsText = gptResult.corrected || primaryText;
      const ttsResponse = await openai.audio.speech.create({
        model: "tts-1",
        voice: safeVoice,
        input: ttsText,
        speed: 0.85,
      });
      const audioBase64 = Buffer.from(await ttsResponse.arrayBuffer()).toString("base64");

      return res.json({
        hasErrors: gptResult.hasErrors ?? false,
        corrected: gptResult.corrected || primaryText,
        original: primaryText,
        whisperText,
        assemblyText,
        feedback: gptResult.feedback || "",
        score: gptResult.score ?? 100,
        pronunciationIssues: Array.from(new Set([...(gptResult.pronunciationIssues ?? []), ...pronunciationIssues])),
        wordScores,
        azureScores: null,
        audioBase64,
      });
    } catch (err: any) {
      console.error("Pronunciation analyze error:", err?.message || err);
      return res.status(500).json({ error: "Analiz başarısız oldu." });
    }
  }
);

export default router;
