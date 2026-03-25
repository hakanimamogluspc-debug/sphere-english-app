import { Router, Request, Response } from "express";
import OpenAI from "openai";
import multer from "multer";
import { authMiddleware } from "../middlewares/auth.js";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ALLOWED_VOICES = ["nova", "onyx", "shimmer", "echo", "alloy", "fable"] as const;
type Voice = typeof ALLOWED_VOICES[number];

// ─── Azure Pronunciation Assessment ─────────────────────────────────────────

interface AzureWordResult {
  Word: string;
  PronunciationAssessment: {
    AccuracyScore: number;
    ErrorType: string; // "None" | "Omission" | "Insertion" | "Mispronunciation"
  };
  Phonemes?: { Phoneme: string; PronunciationAssessment: { AccuracyScore: number } }[];
}

interface AzurePronunciationResult {
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore: number;
  words: { word: string; accuracyScore: number; errorType: string }[];
  mispronounced: string[];
}

async function assessPronunciation(
  audioBuffer: Buffer,
  referenceText: string,
  mimeType: string
): Promise<AzurePronunciationResult | null> {
  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION || "westeurope";

  if (!azureKey) return null;

  const assessmentConfig = Buffer.from(
    JSON.stringify({
      ReferenceText: referenceText,
      GradingSystem: "HundredMark",
      Granularity: "Word",
      EnableMiscue: true,
    })
  ).toString("base64");

  try {
    const url = `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": azureKey,
        "Content-Type": mimeType.includes("webm") ? "audio/webm;codecs=opus" : "audio/wav;codecs=audio/pcm;samplerate=16000",
        "Pronunciation-Assessment": assessmentConfig,
      },
      body: audioBuffer,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Azure Speech API error:", res.status, errText);
      return null;
    }

    const data = await res.json() as any;
    const nbest = data?.NBest?.[0];
    if (!nbest) return null;

    const pa = nbest.PronunciationAssessment;
    const words: AzureWordResult[] = nbest.Words || [];

    const wordResults = words.map((w) => ({
      word: w.Word,
      accuracyScore: w.PronunciationAssessment?.AccuracyScore ?? 100,
      errorType: w.PronunciationAssessment?.ErrorType ?? "None",
    }));

    const mispronounced = wordResults
      .filter((w) => w.errorType !== "None" || w.accuracyScore < 70)
      .map((w) => w.word);

    return {
      accuracyScore: pa?.AccuracyScore ?? 0,
      fluencyScore: pa?.FluencyScore ?? 0,
      completenessScore: pa?.CompletenessScore ?? 0,
      prosodyScore: pa?.ProsodyScore ?? 0,
      words: wordResults,
      mispronounced,
    };
  } catch (e: any) {
    console.warn("Azure Pronunciation Assessment failed:", e?.message);
    return null;
  }
}

// ─── Route ───────────────────────────────────────────────────────────────────

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

      const hasAudio = req.file && req.file.buffer.length > 1000;

      // ── Whisper transcription (raw audio → reference text) ──
      let whisperText = webSpeechText;
      if (hasAudio) {
        try {
          const audioFile = new File([req.file!.buffer], "audio.webm", {
            type: req.file!.mimetype || "audio/webm",
          });
          const whisperRes = await openai.audio.transcriptions.create({
            model: "whisper-1",
            file: audioFile,
            language: "en",
            temperature: 0,
          });
          whisperText = whisperRes.text.trim();
        } catch (e: any) {
          console.warn("Whisper error:", e?.message);
        }
      }

      // ── Azure Pronunciation Assessment ──
      let azureResult: AzurePronunciationResult | null = null;
      if (hasAudio) {
        azureResult = await assessPronunciation(
          req.file!.buffer,
          whisperText || webSpeechText,
          req.file!.mimetype || "audio/webm"
        );
      }

      // ── Build pronunciation context for GPT ──
      const azureContext = azureResult
        ? `Azure Telaffuz Değerlendirmesi:
- Doğruluk (Accuracy): ${azureResult.accuracyScore}/100
- Akıcılık (Fluency): ${azureResult.fluencyScore}/100
- Eksiksizlik (Completeness): ${azureResult.completenessScore}/100
${azureResult.mispronounced.length > 0 ? `- Sorunlu kelimeler: ${azureResult.mispronounced.join(", ")}` : "- Telaffuz sorunsuz"}`
        : "Azure telaffuz analizi yok (sadece gramer analizi)";

      // ── GPT grammar + feedback ──
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Sen İngilizce konuşma koçusun.

ÖNEMLİ: Bu bir KONUŞMA analizidir.
- Büyük/küçük harf, noktalama ASLA hata değildir.
- Sadece konuşmada duyulabilecek hatalar önemli: yanlış kelime, eksik/fazla kelime, yanlış zaman kipi.

${azureContext}

JSON döndür:
- hasErrors: boolean (gramer VEYA telaffuz hatası varsa true)
- corrected: string (düzeltilmiş hali, yoksa orijinal)
- feedback: string (1-2 cümle Türkçe. Azure verileri varsa telaffuz puanlarını ve sorunlu kelimeleri belirt.)
- score: number (Azure varsa accuracy score'u kullan. Yoksa gramer hatasına göre 70-100 arası ver.)
- pronunciationIssues: string[] (Azure'dan gelen sorunlu kelimeler)`,
          },
          {
            role: "user",
            content: `Söylenen: "${webSpeechText}"`,
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
        score: gptResult.score ?? azureResult?.accuracyScore ?? 100,
        pronunciationIssues: gptResult.pronunciationIssues ?? azureResult?.mispronounced ?? [],
        azureScores: azureResult
          ? {
              accuracy: azureResult.accuracyScore,
              fluency: azureResult.fluencyScore,
              completeness: azureResult.completenessScore,
              prosody: azureResult.prosodyScore,
            }
          : null,
        audioBase64,
      });
    } catch (err: any) {
      console.error("Pronunciation analyze error:", err?.message || err);
      return res.status(500).json({ error: "Analysis failed" });
    }
  }
);

export default router;
