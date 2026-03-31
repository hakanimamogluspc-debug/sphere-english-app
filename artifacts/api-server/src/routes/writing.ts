import { Router, Request, Response } from "express";
import OpenAI from "openai";
import { authMiddleware } from "../middlewares/auth.js";

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

const WRITING_TYPES: Record<string, string> = {
  "business-email": "İş E-postası",
  "formal-letter": "Resmi Mektup",
  "essay": "Kompozisyon / Essay",
  "report": "Rapor",
  "general": "Genel Yazı",
};

router.post("/writing/analyze", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { text, writingType = "general", topic = "" } = req.body as {
      text: string;
      writingType?: string;
      topic?: string;
    };

    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: "Lütfen en az 20 karakterlik bir metin girin." });
    }

    if (text.trim().length > 3000) {
      return res.status(400).json({ error: "Metin en fazla 3000 karakter olabilir." });
    }

    const typeName = WRITING_TYPES[writingType] || WRITING_TYPES["general"];
    const topicLine = topic ? `Konu: "${topic}"` : "";

    const systemPrompt = `Sen deneyimli bir İngilizce yazma koçusun. Öğrencilerin İngilizce yazılarını analiz edip yapıcı, detaylı geri bildirim veriyorsun. Geri bildirimini her zaman Türkçe veriyorsun, ancak düzeltilen metin ve örnekler İngilizce olacak.

Analiz ettiğin yazı türü: ${typeName}
${topicLine}

Şu formatta JSON yanıtı ver (başka hiçbir şey yazma, sadece JSON):
{
  "overallScore": "<A1/A2/B1/B2/C1/C2>",
  "overallComment": "<Genel değerlendirme, 2-3 cümle>",
  "grammarScore": <1-10 arası sayı>,
  "grammarFeedback": "<Dilbilgisi değerlendirmesi>",
  "grammarErrors": [
    { "original": "<hatalı ifade>", "corrected": "<doğrusu>", "explanation": "<açıklama türkçe>" }
  ],
  "vocabularyScore": <1-10 arası sayı>,
  "vocabularyFeedback": "<Kelime hazinesi değerlendirmesi>",
  "vocabularySuggestions": [
    { "original": "<sıradan kelime>", "advanced": "<daha iyi alternatif>", "example": "<örnek cümle>" }
  ],
  "coherenceScore": <1-10 arası sayı>,
  "coherenceFeedback": "<Bağlantı ve akış değerlendirmesi>",
  "styleScore": <1-10 arası sayı>,
  "styleFeedback": "<Yazı stili değerlendirmesi (${typeName} için uygunluk)>",
  "strengths": ["<güçlü yön 1>", "<güçlü yön 2>"],
  "improvements": ["<geliştirilecek alan 1>", "<geliştirilecek alan 2>"],
  "improvedVersion": "<Yazının düzeltilmiş ve geliştirilmiş İngilizce versiyonu>"
}`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Lütfen şu metni analiz et:\n\n${text.trim()}` },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const rawContent = completion.choices[0]?.message?.content ?? "";

    let analysis;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON bulunamadı");
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(500).json({ error: "AI yanıtı işlenemedi. Lütfen tekrar deneyin." });
    }

    return res.json({ analysis });
  } catch (err: any) {
    console.error("[writing] Hata:", err?.message || err);
    return res.status(500).json({ error: "Analiz sırasında bir hata oluştu. Lütfen tekrar deneyin." });
  }
});

export default router;
