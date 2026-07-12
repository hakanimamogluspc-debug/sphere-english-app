/**
 * Azure Speech Pronunciation Assessment — Microsoft resmi SDK ile.
 *
 * SDK yaklaşımı REST üzerinde çok daha güvenilir:
 *   - Strongly-typed result (undefined field'lar yok)
 *   - Otomatik retry, reconnect
 *   - PronunciationAssessmentResult tüm skorları garantili verir
 *   - Word + Syllable + Phoneme granularity destekler
 *
 * Env vars:
 *   AZURE_SPEECH_KEY
 *   AZURE_SPEECH_REGION  (default: westeurope)
 *
 * Kullanım (interface değişmedi):
 *   const result = await analyzePronunciation(audioBuffer, {
 *     referenceText: "Good morning",
 *     enableProsodyAssessment: true,
 *   });
 */

import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import * as speechsdk from "microsoft-cognitiveservices-speech-sdk";

const execFileAsync = promisify(execFile);

export interface AzurePronunciationOptions {
  referenceText?: string;
  phonemeAlphabet?: "IPA" | "SAPI";
  granularity?: "Phoneme" | "Word" | "FullText";
  enableMiscue?: boolean;
  enableProsodyAssessment?: boolean;
  language?: string;
}

export interface AzurePronunciationResult {
  pronScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore: number | null;
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
  recognizedText: string;
  audioDurationSec: number;
}

/**
 * WebM/MP3/OGG → WAV 16kHz mono PCM.
 * SDK PushAudioInputStream WAV/16kHz/mono/PCM bekler.
 */
export async function convertToWav16kMono(inputBuffer: Buffer): Promise<Buffer> {
  const tmpIn = path.join(os.tmpdir(), `az_${Date.now()}_${Math.random()}.raw`);
  const tmpOut = path.join(os.tmpdir(), `az_${Date.now()}_${Math.random()}.wav`);
  try {
    fs.writeFileSync(tmpIn, inputBuffer);

    // Deneme 1: Basit silence trim (başlangıç sessizlik)
    try {
      await execFileAsync("ffmpeg", [
        "-y", "-i", tmpIn,
        "-vn",
        "-af", "silenceremove=start_periods=1:start_duration=0.1:start_threshold=-45dB",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        tmpOut,
      ]);
      const buf = fs.readFileSync(tmpOut);
      if (buf.length < 1024) {
        throw new Error("Silence removal çıktısı çok küçük");
      }
      return buf;
    } catch (trimErr: any) {
      console.warn("[azure-pron] silence trim fail, basit conversion:", trimErr?.message);
    }

    // Deneme 2: Filter yok
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
 * WAV buffer'dan Duration okur (RIFF header parse).
 * SDK bize duration vermez, biz hesaplayalım.
 */
function readWavDurationSec(wavBuffer: Buffer): number {
  try {
    // RIFF header: 44 bytes
    // Sample rate at offset 24 (4 bytes LE)
    // Data chunk size at offset 40 (4 bytes LE)
    if (wavBuffer.length < 44) return 0;
    const sampleRate = wavBuffer.readUInt32LE(24);
    const dataSize = wavBuffer.readUInt32LE(40);
    if (sampleRate === 0) return 0;
    // 16-bit mono → 2 bytes per sample
    const samples = dataSize / 2;
    return samples / sampleRate;
  } catch {
    return 0;
  }
}

/**
 * Azure Pronunciation Assessment — SDK ile.
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
    // 1) WAV 16kHz mono'ya dönüştür
    const wavBuffer = await convertToWav16kMono(audioBuffer);
    const audioDurationSec = readWavDurationSec(wavBuffer);

    // 2) SDK kurulumu
    const speechConfig = speechsdk.SpeechConfig.fromSubscription(azureKey, azureRegion);
    speechConfig.speechRecognitionLanguage = language;

    // Pronunciation Assessment config
    const granularityEnum =
      granularity === "FullText"
        ? speechsdk.PronunciationAssessmentGranularity.FullText
        : granularity === "Word"
          ? speechsdk.PronunciationAssessmentGranularity.Word
          : speechsdk.PronunciationAssessmentGranularity.Phoneme;

    const pronConfig = new speechsdk.PronunciationAssessmentConfig(
      referenceText,
      speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
      granularityEnum,
      enableMiscue,
    );
    pronConfig.phonemeAlphabet = phonemeAlphabet;
    pronConfig.nbestPhonemeCount = 3;
    if (enableProsodyAssessment) {
      pronConfig.enableProsodyAssessment = true;
    }

    // 3) Audio stream — buffer'ı push et
    // WAV header formatı belirt (16-bit PCM, 16kHz, mono)
    const audioFormat = speechsdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
    const pushStream = speechsdk.AudioInputStream.createPushStream(audioFormat);
    // WAV header (44 byte) atla, sadece raw PCM data'yı yaz
    const pcmData = wavBuffer.length > 44 ? wavBuffer.subarray(44) : wavBuffer;
    // SDK ArrayBuffer bekliyor — Buffer → ArrayBuffer dönüşümü
    const arrBuf = pcmData.buffer.slice(
      pcmData.byteOffset,
      pcmData.byteOffset + pcmData.byteLength,
    ) as ArrayBuffer;
    pushStream.write(arrBuf);
    pushStream.close();

    const audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
    pronConfig.applyTo(recognizer);

    // 4) Recognize + Pronunciation Assessment
    const result: speechsdk.SpeechRecognitionResult = await new Promise((resolve, reject) => {
      const timeoutMs = 25_000;
      const timer = setTimeout(() => {
        try {
          recognizer.stopContinuousRecognitionAsync();
        } catch {}
        reject(new Error("Azure SDK timeout"));
      }, timeoutMs);

      recognizer.recognizeOnceAsync(
        (r) => {
          clearTimeout(timer);
          resolve(r);
        },
        (err) => {
          clearTimeout(timer);
          reject(new Error(String(err)));
        },
      );
    });

    // Cleanup
    try { recognizer.close(); } catch {}

    if (result.reason === speechsdk.ResultReason.Canceled) {
      const cancel = speechsdk.CancellationDetails.fromResult(result);
      console.error(
        `[azure-pron] Recognition canceled: reason=${cancel.reason}, error=${cancel.errorDetails}`,
      );
      return null;
    }

    if (result.reason !== speechsdk.ResultReason.RecognizedSpeech) {
      console.warn(`[azure-pron] Recognition reason=${result.reason}, text="${result.text}"`);
      // Text varsa yine devam et — pronunciation olmayabilir ama transcript var
      if (!result.text) return null;
    }

    // 5) Pronunciation result parse
    const pronResult = speechsdk.PronunciationAssessmentResult.fromResult(result);

    // detailResult raw JSON — Words[] kelime-seviyesi detay için
    const detail: any = (result as any).privJson
      ? JSON.parse((result as any).privJson)
      : {};
    const nBest = detail.NBest?.[0] ?? {};
    const rawWords = nBest.Words ?? [];

    const words = rawWords.map((w: any) => {
      const wpa = w.PronunciationAssessment ?? {};
      return {
        word: String(w.Word ?? ""),
        accuracyScore: Number(wpa.AccuracyScore ?? w.AccuracyScore ?? 0),
        errorType: String(wpa.ErrorType ?? w.ErrorType ?? "None") as any,
        phonemes: Array.isArray(w.Phonemes)
          ? w.Phonemes.map((p: any) => {
              const ppa = p.PronunciationAssessment ?? {};
              return {
                phoneme: String(p.Phoneme ?? ""),
                accuracyScore: Number(ppa.AccuracyScore ?? p.AccuracyScore ?? 0),
              };
            })
          : [],
      };
    });

    const finalResult: AzurePronunciationResult = {
      pronScore: Math.round(pronResult.pronunciationScore ?? 0),
      accuracyScore: Math.round(pronResult.accuracyScore ?? 0),
      fluencyScore: Math.round(pronResult.fluencyScore ?? 0),
      completenessScore: Math.round(pronResult.completenessScore ?? 0),
      prosodyScore:
        (pronResult as any).prosodyScore != null
          ? Math.round((pronResult as any).prosodyScore)
          : null,
      words,
      recognizedText: String(result.text ?? ""),
      audioDurationSec,
    };

    console.info(
      `[azure-pron] SDK OK — recognized="${finalResult.recognizedText.slice(0, 50)}", words=${finalResult.words.length}, pron=${finalResult.pronScore}, acc=${finalResult.accuracyScore}, flu=${finalResult.fluencyScore}, comp=${finalResult.completenessScore}, prosody=${finalResult.prosodyScore}`,
    );

    return finalResult;
  } catch (e: any) {
    console.error("[azure-pron] SDK HATA:", e?.message);
    return null;
  }
}

/**
 * Word-level analiz — düşük skorlu kelimeler için Türkçe geri bildirim üret.
 */
export function buildWordFeedback(result: AzurePronunciationResult): Array<{
  word: string;
  score: number;
  errorType: string;
  weakPhonemes: string[];
  feedbackTr: string | null;
}> {
  return result.words
    .filter((w) => w.accuracyScore > 5)
    .map((w) => {
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
