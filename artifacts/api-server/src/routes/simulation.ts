import { Router, Request, Response } from "express";
import OpenAI from "openai";
import multer from "multer";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";

const execFileAsync = promisify(execFile);
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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const ALLOWED_VOICES = ["nova", "onyx", "shimmer", "echo", "alloy", "fable"] as const;
type Voice = typeof ALLOWED_VOICES[number];

async function convertToMp3(inputBuffer: Buffer): Promise<Buffer> {
  const tmpIn = path.join(os.tmpdir(), `sim_in_${Date.now()}.webm`);
  const tmpOut = path.join(os.tmpdir(), `sim_out_${Date.now()}.mp3`);
  try {
    fs.writeFileSync(tmpIn, inputBuffer);
    await execFileAsync("ffmpeg", ["-y", "-i", tmpIn, "-ar", "16000", "-ac", "1", "-b:a", "64k", tmpOut]);
    return fs.readFileSync(tmpOut);
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

async function transcribe(audioBuffer: Buffer): Promise<string> {
  let finalBuffer = audioBuffer;
  let finalExt = "mp3";
  let finalMime = "audio/mpeg";
  try {
    finalBuffer = await convertToMp3(audioBuffer);
  } catch {
    finalExt = "webm";
    finalMime = "audio/webm";
  }
  const audioFile = new File([finalBuffer], `audio.${finalExt}`, { type: finalMime });
  const res = await getOpenAI().audio.transcriptions.create({
    model: "whisper-1",
    file: audioFile,
    language: "en",
    response_format: "text",
    temperature: 0.1,
    prompt: "Business English conversation. Transcribe exactly as said. May include Turkish proper nouns.",
  } as any);
  return (res as unknown as string).trim();
}

export interface SimGrammarError { original: string; corrected: string; explanation: string }
export interface SimVocabSuggestion { original: string; better: string; explanation: string }
export interface SimTurnAnalysis {
  grammarErrors: SimGrammarError[];
  vocabSuggestions: SimVocabSuggestion[];
  score: number;
  correctedText: string;
}

async function analyzeForSimulation(text: string, sector: string): Promise<SimTurnAnalysis> {
  const systemPrompt = `You are a business English coach analyzing a Turkish professional's spoken English in a ${sector} simulation.
Analyze for grammar errors and better professional vocabulary alternatives.
Always respond in valid JSON only.

Return:
{
  "grammarErrors": [{"original": "<wrong>", "corrected": "<fixed>", "explanation": "<Turkish explanation, max 10 words>"}],
  "vocabSuggestions": [{"original": "<basic/wrong>", "better": "<more professional>", "explanation": "<Turkish explanation, max 10 words>"}],
  "score": <50-100>,
  "correctedText": "<full corrected version in English>"
}

Rules:
- grammarErrors: Max 3. Only real mistakes (tense, articles, prepositions, agreement).
- vocabSuggestions: Max 2. Only if there's a clearly more professional alternative.
- score: 50-100. Professional fluent = 85+. Many errors = 50-65.
- All explanations in Turkish. correctedText in English.
- Return empty arrays if no issues.`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Transcribed speech: "${text}"` },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON not found");
    return JSON.parse(match[0]) as SimTurnAnalysis;
  } catch {
    return { grammarErrors: [], vocabSuggestions: [], score: 75, correctedText: text };
  }
}

interface HistoryMessage { role: "user" | "assistant"; content: string }

router.post(
  "/simulation/chat",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      const body = (req.body as Record<string, string>) || {};
      const voice = body.voice as Voice;
      const safeVoice: Voice = ALLOWED_VOICES.includes(voice) ? voice : "nova";
      const systemPrompt: string = body.systemPrompt || "You are a professional business person.";
      const sector: string = body.sector || "general";

      let history: HistoryMessage[] = [];
      try { history = JSON.parse(body.history || "[]"); } catch {}

      if (!req.file || req.file.buffer.length < 3000) {
        return res.status(400).json({ error: "Ses kaydı çok kısa. En az 2 saniye konuşun." });
      }

      const userText = await transcribe(req.file.buffer);
      if (!userText) {
        return res.status(400).json({ error: "Ses anlaşılamadı. Daha yüksek ve net konuşmayı deneyin." });
      }

      const conversationSystemPrompt = `${systemPrompt}

SIMULATION RULES:
- You are the professional counterpart in this business scenario (client, manager, partner, buyer, official, etc.).
- The user is a Turkish professional practicing business English. Engage realistically.
- Keep your responses concise: 2-4 sentences max.
- Use natural, authentic business language appropriate to your character.
- Ask follow-up questions or make requests to keep the conversation flowing.
- Do NOT correct the user's English — just respond naturally as your character.
- Always respond in English only.
- Stay fully in character throughout the conversation.`;

      const gptMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: conversationSystemPrompt },
        ...history.slice(-8).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: userText },
      ];

      const [completion, turnAnalysis] = await Promise.all([
        getOpenAI().chat.completions.create({
          model: "gpt-4o-mini",
          messages: gptMessages,
          temperature: 0.75,
          max_tokens: 150,
        }),
        analyzeForSimulation(userText, sector),
      ]);

      const reply = completion.choices[0].message.content?.trim() || "I see. Please continue.";

      const ttsResponse = await getOpenAI().audio.speech.create({
        model: "tts-1",
        voice: safeVoice,
        input: reply,
        speed: 0.95,
      });
      const audioBase64 = Buffer.from(await ttsResponse.arrayBuffer()).toString("base64");

      return res.json({ userText, reply, audioBase64, turnAnalysis });
    } catch (err: any) {
      console.error("Simulation chat error:", err?.message || err);
      return res.status(500).json({ error: "Bir hata oluştu. Lütfen tekrar deneyin." });
    }
  }
);

export default router;
