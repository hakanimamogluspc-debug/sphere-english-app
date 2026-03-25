import { Router, Request, Response } from "express";
import OpenAI from "openai";
import multer from "multer";
import { authMiddleware } from "../middlewares/auth.js";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ALLOWED_VOICES = ["nova", "onyx", "shimmer", "echo", "alloy", "fable"] as const;
type Voice = typeof ALLOWED_VOICES[number];

// ─── AssemblyAI pronunciation (optional, if API key provided) ─────────────────

async function assessWithAssemblyAI(
  audioBuffer: Buffer,
  mimeType: string
): Promise<{ words: { text: string; confidence: number }[]; mispronounced: string[] } | null> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) return null;

  try {
    // 1. Upload audio
    const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: { authorization: apiKey, "content-type": mimeType || "audio/webm" },
      body: audioBuffer,
    });
    if (!uploadRes.ok) return null;
    const { upload_url } = await uploadRes.json() as { upload_url: string };

    // 2. Request transcription with word-level confidence
    const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: { authorization: apiKey, "content-type": "application/json" },
      body: JSON.stringify({ audio_url: upload_url, language_code: "en", punctuate: false }),
    });
    if (!transcriptRes.ok) return null;
    const { id } = await transcriptRes.json() as { id: string };

    // 3. Poll for result (max 15s for short clips)
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { authorization: apiKey },
      });
      const poll = await pollRes.json() as any;
      if (poll.status === "completed") {
        const words = (poll.words || []).map((w: any) => ({
          text: w.text as string,
          confidence: w.confidence as number,
        }));
        const mispronounced = words
          .filter((w: { text: string; confidence: number }) => w.confidence < 0.75)
          .map((w: { text: string; confidence: number }) => w.text);
        return { words, mispronounced };
      }
      if (poll.status === "error") return null;
    }
    return null;
  } catch (e: any) {
    console.warn("AssemblyAI error:", e?.message);
    return null;
  }
}

// ─── Whisper verbose — word-level confidence (no extra API key needed) ────────

interface WhisperWord { word: string; start: number; end: number; probability: number }

async function transcribeWithWhisper(
  audioBuffer: Buffer,
  mimeType: string
): Promise<{ text: string; words: WhisperWord[]; mispronounced: string[] } | null> {
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
      word: w.word?.trim() || "",
      start: w.start ?? 0,
      end: w.end ?? 0,
      probability: w.probability ?? 1,
    }));

    const mispronounced = words
      .filter((w) => w.probability < 0.80 && w.word.length > 1)
      .map((w) => w.word);

    return { text: data.text?.trim() || "", words, mispronounced };
  } catch (e: any) {
    console.warn("Whisper verbose error:", e?.message);
    return null;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

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

      const hasAudio = !!(req.file && req.file.buffer.length > 1000);

      // ── Transcription: Whisper verbose (word confidence) ──
      let whisperResult: { text: string; words: WhisperWord[]; mispronounced: string[] } | null = null;
      if (hasAudio) {
        whisperResult = await transcribeWithWhisper(req.file!.buffer, req.file!.mimetype || "audio/webm");
      }

      // ── Optional: AssemblyAI (if API key set) ──
      let assemblyResult: { words: { text: string; confidence: number }[]; mispronounced: string[] } | null = null;
      if (hasAudio && process.env.ASSEMBLYAI_API_KEY) {
        assemblyResult = await assessWithAssemblyAI(req.file!.buffer, req.file!.mimetype || "audio/webm");
      }

      // ── Combine pronunciation issues (Whisper low-confidence + words Whisper missed) ──
      const wsWordList = webSpeechText.toLowerCase().replace(/[^a-z\s']/g, "").split(/\s+/).filter(Boolean);
      const whisperTranscriptWords = (whisperResult?.text || "").toLowerCase().replace(/[^a-z\s']/g, "").split(/\s+/).filter(Boolean);
      const missedByWhisper = wsWordList.filter((w) => !whisperTranscriptWords.includes(w));

      const mispronounced = Array.from(new Set([
        ...(whisperResult?.mispronounced || []),
        ...(assemblyResult?.mispronounced || []),
        ...missedByWhisper,
      ]));

      const whisperText = whisperResult?.text || webSpeechText;

      // ── Word scores for UI: align Web Speech words with Whisper output ──
      const wsWords = webSpeechText.toLowerCase().replace(/[^a-z\s']/g, "").split(/\s+/).filter(Boolean);
      const whisperWords = (whisperResult?.text || "").toLowerCase().replace(/[^a-z\s']/g, "").split(/\s+/).filter(Boolean);

      const wordScores = wsWords.map((word) => {
        const match = whisperWords.find((w) => w === word);
        // Also check Whisper word-level probability if available
        const whisperWord = whisperResult?.words.find((w) =>
          w.word.toLowerCase().replace(/[^a-z']/g, "") === word
        );
        let score: number;
        if (match) {
          // Word found in Whisper transcript — use its probability if available
          score = whisperWord ? Math.round(whisperWord.probability * 100) : 95;
        } else {
          // Word NOT found in Whisper — clear pronunciation issue
          score = whisperWord ? Math.round(whisperWord.probability * 100) : 45;
        }
        return { word, score, ok: score >= 80 };
      });

      // ── GPT grammar + pronunciation feedback ──
      const pronunciationContext = mispronounced.length > 0
        ? `Whisper güven analizi: ${mispronounced.join(", ")} kelimelerinde telaffuz sorunu tespit edildi (düşük güven skoru).`
        : whisperResult
        ? "Whisper güven analizi: Tüm kelimeler net telaffuz edilmiş."
        : "Ses analizi yapılamadı.";

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Sen İngilizce konuşma koçusun.

ÖNEMLİ: Bu bir KONUŞMA analizidir.
- Büyük/küçük harf, noktalama işaretleri hata DEĞİLDİR.
- Sadece konuşmada duyulabilecek hatalar: yanlış kelime, eksik/fazla kelime, yanlış zaman kipi.

${pronunciationContext}

JSON döndür:
- hasErrors: boolean (gramer VEYA telaffuz sorunu varsa true)
- corrected: string (konuşma hatası varsa düzeltilmiş hali, yoksa orijinal)
- feedback: string (1-2 cümle Türkçe. Telaffuz sorunu varsa hangi kelimede olduğunu söyle ve örnek ver. İyi telaffuz varsa teşvik et.)
- score: number (0-100. Her telaffuz sorunu -10, her gramer hatası -15 puan. Hiç sorun yoksa 100.)
- pronunciationIssues: string[] (sorunlu kelimeler listesi, yoksa boş dizi)`,
          },
          {
            role: "user",
            content: `Söylenen: "${webSpeechText}"\nWhisper duyduğu: "${whisperText}"`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 300,
      });

      const gptResult = JSON.parse(completion.choices[0].message.content || "{}");

      // ── TTS ──
      const ttsText = gptResult.corrected || webSpeechText;
      const ttsResponse = await openai.audio.speech.create({
        model: "tts-1",
        voice: safeVoice,
        input: ttsText,
        speed: 0.85,
      });
      const audioBase64 = Buffer.from(await ttsResponse.arrayBuffer()).toString("base64");

      return res.json({
        hasErrors: gptResult.hasErrors ?? false,
        corrected: gptResult.corrected || webSpeechText,
        original: webSpeechText,
        whisperText,
        feedback: gptResult.feedback || "",
        score: gptResult.score ?? 100,
        pronunciationIssues: gptResult.pronunciationIssues ?? mispronounced,
        wordScores,
        azureScores: null,
        audioBase64,
      });
    } catch (err: any) {
      console.error("Pronunciation analyze error:", err?.message || err);
      return res.status(500).json({ error: "Analysis failed" });
    }
  }
);

export default router;
