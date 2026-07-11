/**
 * Azure Speech Pronunciation Assessment — ortak helper.
 *
 * Kullanım örnekleri:
 *
 *   // Reference mode (hedef cümle biliniyor):
 *   const result = await analyzePronunciation(audioBuffer, {
 *     referenceText: "Good morning everyone",
 *   });
 *
 *   // Unscripted mode (serbest konuşma):
 *   const result = await analyzePronunciation(audioBuffer, {
 *     referenceText: "",
 *     enableProsodyAssessment: true,
 *   });
 *
 * Env vars:
 *   AZURE_SPEECH_KEY
 *   AZURE_SPEECH_REGION  (default: westeurope)
 *
 * Fiyat: 5 saat/ay ücretsiz (F0), sonrası ~$1/saat.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";

const execFileAsync = promisify(execFile);

export interface AzurePronunciationOptions {
  /** Hedef cümle. Boş bırakılırsa unscripted mode. */
  referenceText?: string;
  /** Fonetik alfabesi — IPA (uluslararası) veya SAPI (Microsoft). */
  phonemeAlphabet?: "IPA" | "SAPI";
  /** Granularity — Phoneme (en detaylı), Word, FullText. */
  granularity?: "Phoneme" | "Word" | "FullText";
  /** Omission/Insertion tespiti — reference mode için */
  enableMiscue?: boolean;
  /** Prosody skoru (vurgu, tonlama) — biraz daha pahalı ama değerli */
  enableProsodyAssessment?: boolean;
  /** Language code — default en-US */
  language?: string;
}

export interface AzurePronunciationResult {
  /** 0-100 — genel pronunciation skoru */
  pronScore: number;
  /** 0-100 — phoneme-level doğruluk */
  accuracyScore: number;
  /** 0-100 — akıcılık (pauses, prosody) */
  fluencyScore: number;
  /** 0-100 — söylenen/hedef oranı (reference mode) */
  completenessScore: number;
  /** 0-100 — prosody (vurgu/tonlama), sadece enableProsodyAssessment=true ise */
  prosodyScore: number | null;
  /** Kelime seviyesi analiz */
  words: Array<{
    word: string;
    accuracyScore: number;
    errorType:
      | "None"
      | "Mispronunciation"
      | "Omission"
      | "Insertion"
      | "UnexpectedBreak"
      | "MissingBreak"
      | "Monotone";
    phonemes: Array<{ phoneme: string; accuracyScore: number }>;
  }>;
  /** Whisper-benzeri transcript — Azure'ın recognize ettiği metin */
  recognizedText: string;
  /** Ses süresi (saniye) */
  audioDurationSec: number;
}

/**
 * WebM/MP3/OGG → WAV 16kHz mono PCM.
 * Azure Speech WAV/16kHz/mono/PCM bekler.
 */
export async function convertToWav16kMono(inputBuffer: Buffer): Promise<Buffer> {
  const tmpIn = path.join(os.tmpdir(), `az_${Date.now()}_${Math.random()}.raw`);
  const tmpOut = path.join(os.tmpdir(), `az_${Date.now()}_${Math.random()}.wav`);
  try {
    fs.writeFileSync(tmpIn, inputBuffer);
    await execFileAsync("ffmpeg", [
      "-y", "-i", tmpIn,
      "-vn",
      "-acodec", "pcm_s16le",
      "-ar", "16000",
      "-ac", "1",
      tmpOut,
    ]);
    return fs.readFileSync(tmpOut);
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

/**
 * Azure Speech Pronunciation Assessment.
 *
 * Reference mode: referenceText verilirse, o cümleye karşı skorlanır (Mispronunciation,
 * Omission, Insertion tespiti aktif olur).
 *
 * Unscripted mode: referenceText boş ise, Azure sadece phoneme confidence + prosody skoru
 * döner (accuracy + fluency + prosody). completenessScore anlamsız olur.
 *
 * Env yoksa null döner — çağıran fallback kullanmalı.
 */
export async function analyzePronunciation(
  audioBuffer: Buffer,
  opts: AzurePronunciationOptions = {},
): Promise<AzurePronunciationResult | null> {
  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION || "westeurope";
  if (!azureKey) {
    console.warn("[azure-pron] AZURE_SPEECH_KEY yok — atlandı");
    return null;
  }

  const {
    referenceText = "",
    phonemeAlphabet = "IPA",
    granularity = "Phoneme",
    enableMiscue = referenceText.length > 0,
    enableProsodyAssessment = true,
    language = "en-US",
  } = opts;

  try {
    // WAV'a dönüştür
    const wavBuffer = await convertToWav16kMono(audioBuffer);

    // Config header (base64 encoded)
    const config: any = {
      ReferenceText: referenceText,
      GradingSystem: "HundredMark",
      Granularity: granularity,
      EnableMiscue: enableMiscue,
      PhonemeAlphabet: phonemeAlphabet,
      NBestPhonemeCount: 3,
    };
    if (enableProsodyAssessment) {
      config.EnableProsodyAssessment = true;
    }
    const configBase64 = Buffer.from(JSON.stringify(config)).toString("base64");

    const endpoint =
      `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
      `?language=${encodeURIComponent(language)}&format=detailed`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": azureKey,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        Accept: "application/json",
        "Pronunciation-Assessment": configBase64,
      },
      body: wavBuffer as any,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[azure-pron] HTTP ${response.status}:`, errText.slice(0, 200));
      return null;
    }

    const data: any = await response.json();
    const nBest = data.NBest?.[0];
    if (!nBest) {
      console.warn("[azure-pron] NBest boş:", data.RecognitionStatus);
      return null;
    }

    const pa = nBest.PronunciationAssessment ?? {};
    const words = (nBest.Words ?? []).map((w: any) => ({
      word: String(w.Word ?? ""),
      accuracyScore: Number(w.PronunciationAssessment?.AccuracyScore ?? 0),
      errorType: String(w.PronunciationAssessment?.ErrorType ?? "None") as any,
      phonemes: Array.isArray(w.Phonemes)
        ? w.Phonemes.map((p: any) => ({
            phoneme: String(p.Phoneme ?? ""),
            accuracyScore: Number(p.PronunciationAssessment?.AccuracyScore ?? 0),
          }))
        : [],
    }));

    return {
      pronScore: Math.round(Number(pa.PronScore ?? pa.PronunciationScore ?? 0)),
      accuracyScore: Math.round(Number(pa.AccuracyScore ?? 0)),
      fluencyScore: Math.round(Number(pa.FluencyScore ?? 0)),
      completenessScore: Math.round(Number(pa.CompletenessScore ?? 0)),
      prosodyScore:
        pa.ProsodyScore != null ? Math.round(Number(pa.ProsodyScore)) : null,
      words,
      recognizedText: String(data.DisplayText ?? nBest.Display ?? ""),
      audioDurationSec: Number(data.Duration ?? 0) / 10_000_000, // 100ns → sec
    };
  } catch (e: any) {
    console.error("[azure-pron] HATA:", e?.message);
    return null;
  }
}

/**
 * Word-level analiz — düşük skorlu kelimeler için Türkçe geri bildirim üret.
 * Frontend'de renkli göstermek için kullanışlı.
 */
export function buildWordFeedback(result: AzurePronunciationResult): Array<{
  word: string;
  score: number;
  errorType: string;
  weakPhonemes: string[];
  feedbackTr: string | null;
}> {
  return result.words.map((w) => {
    const weakPhonemes = w.phonemes
      .filter((p) => p.accuracyScore < 70)
      .sort((a, b) => a.accuracyScore - b.accuracyScore)
      .slice(0, 3)
      .map((p) => p.phoneme);

    let feedbackTr: string | null = null;
    if (w.errorType === "Omission") {
      feedbackTr = "Söylenmedi — bu kelimeyi atladın";
    } else if (w.errorType === "Insertion") {
      feedbackTr = "Fazla kelime — hedefte olmayan bir ses eklendi";
    } else if (w.errorType === "Mispronunciation" || w.accuracyScore < 70) {
      if (weakPhonemes.length > 0) {
        feedbackTr = `Telaffuz zayıf — özellikle /${weakPhonemes.join(", /")}/ seslerine dikkat et`;
      } else {
        feedbackTr = "Telaffuzun anlaşılır ama netliği düşük";
      }
    } else if (w.errorType === "UnexpectedBreak") {
      feedbackTr = "Beklenmeyen duraklama — akış bozuldu";
    } else if (w.errorType === "MissingBreak") {
      feedbackTr = "Gerekli mola atlandı — daha doğal akıcılık için nefes al";
    } else if (w.errorType === "Monotone") {
      feedbackTr = "Ton düz — vurguyu değiştirerek anlamı güçlendir";
    }

    return {
      word: w.word,
      score: w.accuracyScore,
      errorType: w.errorType,
      weakPhonemes,
      feedbackTr,
    };
  });
}
