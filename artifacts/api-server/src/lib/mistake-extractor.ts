/**
 * Mistake extraction — kullanıcı konuşmalarından hata çıkarımı.
 *
 * AI Tutor sohbetlerindeki 'user' rolündeki mesajları GPT-4o-mini ile analiz eder,
 * grammar/vocab/collocation/spelling hatalarını user_mistakes tablosuna kaydeder.
 *
 * extractFromConversation(convoId): tek sohbeti işler
 * extractPending(limit): mistakes_extracted_at NULL olan (en az 5 dk önce mesaj alan) sohbetleri işler
 */

import OpenAI from "openai";
import { pool } from "@workspace/db";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY yok");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

const SYSTEM_PROMPT = `Sen bir İngilizce öğretmenisin. Türk öğrencinin İngilizce konuşma / yazma pratiğindeki mesajlarını incele.

Sadece belirgin, düzeltilmeye değer HATALARI çıkar. Küçük stil tercihlerini ATLA.

Her hata için JSON döndür:
{
  "mistakes": [
    {
      "wrong_text": "kullanıcının yazdığı yanlış parça (kısa alıntı, 1-8 kelime)",
      "correct_text": "doğrusu",
      "mistake_type": "grammar" | "vocab" | "collocation" | "spelling" | "register" | "pronunciation",
      "explanation": "Türkçe 1-2 cümle: kural + neden yanlış",
      "context": "hatanın geçtiği tam cümle (İngilizce, orijinal)",
      "tags": ["past-simple", "articles", ...] // 1-3 etiket
    }
  ]
}

KURALLAR:
- Aynı mesajda aynı hata 2 kez varsa 1 kez ekle
- "You said" gibi meta yorumlar yazma, sadece hata alıntısı
- Türkçe açıklamalar samimi ama profesyonel — "Şurada X, çünkü Y" şeklinde
- Hata YOK ise: {"mistakes": []}
- En fazla 8 hata çıkar
- Sadece JSON döndür`;

type ExtractedMistake = {
  wrong_text: string;
  correct_text: string;
  mistake_type: string;
  explanation: string;
  context: string;
  tags: string[];
};

const VALID_TYPES = ["grammar", "vocab", "collocation", "spelling", "register", "pronunciation", "other"];

async function callGpt(userMessages: string[]): Promise<ExtractedMistake[]> {
  const joined = userMessages.map((m, i) => `[Msg ${i + 1}]: ${m}`).join("\n\n");
  const res: any = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Öğrencinin mesajları:\n\n${joined}` },
    ],
  });
  const raw = res?.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.mistakes)) return [];
  return parsed.mistakes.slice(0, 8).map((m: any) => ({
    wrong_text: String(m.wrong_text ?? "").slice(0, 500),
    correct_text: String(m.correct_text ?? "").slice(0, 500),
    mistake_type: VALID_TYPES.includes(m.mistake_type) ? m.mistake_type : "other",
    explanation: String(m.explanation ?? "").slice(0, 1000),
    context: String(m.context ?? "").slice(0, 1000),
    tags: Array.isArray(m.tags) ? m.tags.slice(0, 4).map((t: any) => String(t).slice(0, 40)) : [],
  })).filter((m: ExtractedMistake) => m.wrong_text.trim().length > 0);
}

/** Bir hata mevcut mu? Aynı user + type + wrong_text → occurrence_count++ */
async function upsertMistake(userId: number, m: ExtractedMistake, source: string, sourceRef: string, cefrTag: string | null) {
  const existing: any = await pool.query(
    `SELECT id, occurrence_count FROM user_mistakes
       WHERE user_id = $1 AND mistake_type = $2 AND LOWER(wrong_text) = LOWER($3)
       ORDER BY last_seen_at DESC LIMIT 1`,
    [userId, m.mistake_type, m.wrong_text],
  );
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE user_mistakes
         SET occurrence_count = occurrence_count + 1,
             last_seen_at = NOW(),
             correct_text = COALESCE(correct_text, $2),
             explanation  = COALESCE(explanation, $3),
             context      = COALESCE(context, $4)
       WHERE id = $1`,
      [existing.rows[0].id, m.correct_text || null, m.explanation || null, m.context || null],
    );
  } else {
    await pool.query(
      `INSERT INTO user_mistakes
         (user_id, mistake_type, wrong_text, correct_text, explanation, context,
          source_module, source_ref, cefr_tag, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [userId, m.mistake_type, m.wrong_text, m.correct_text || null, m.explanation || null,
       m.context || null, source, sourceRef, cefrTag, m.tags],
    );
  }
}

export async function extractFromConversation(convoId: number): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const convo: any = await pool.query(
      `SELECT c.id, c.user_id, u.current_level
         FROM ai_tutor_conversations c
         JOIN users u ON u.id = c.user_id
         WHERE c.id = $1`,
      [convoId],
    );
    if (!convo.rows[0]) return { ok: false, error: "sohbet bulunamadı" };
    const userId: number = convo.rows[0].user_id;
    const cefr: string | null = convo.rows[0].current_level ?? null;

    // Kullanıcının bu sohbetteki mesajları (son 20, meta hariç)
    const msgs: any = await pool.query(
      `SELECT content FROM ai_tutor_messages
         WHERE conversation_id = $1 AND role = 'user'
         ORDER BY created_at DESC LIMIT 20`,
      [convoId],
    );
    const texts: string[] = msgs.rows
      .map((r: any) => String(r.content ?? "").trim())
      .filter((t: string) => t.length >= 8 && t.length <= 2000);

    if (texts.length === 0) {
      await pool.query(`UPDATE ai_tutor_conversations SET mistakes_extracted_at = NOW() WHERE id = $1`, [convoId]);
      return { ok: true, count: 0 };
    }

    const mistakes = await callGpt(texts);
    for (const m of mistakes) {
      await upsertMistake(userId, m, "ai_tutor", String(convoId), cefr);
    }
    await pool.query(`UPDATE ai_tutor_conversations SET mistakes_extracted_at = NOW() WHERE id = $1`, [convoId]);
    return { ok: true, count: mistakes.length };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/** mistakes_extracted_at NULL olan, son mesajı >5 dk önce alan sohbetler */
export async function extractPending(limit = 10): Promise<{ processed: number; totalMistakes: number; errors: string[] }> {
  const r: any = await pool.query(
    `SELECT id FROM ai_tutor_conversations
       WHERE mistakes_extracted_at IS NULL
         AND last_message_at < NOW() - INTERVAL '5 minutes'
         AND EXISTS (SELECT 1 FROM ai_tutor_messages m WHERE m.conversation_id = ai_tutor_conversations.id AND m.role = 'user')
       ORDER BY last_message_at DESC
       LIMIT $1`,
    [limit],
  );
  const ids: number[] = r.rows.map((row: any) => row.id);
  let total = 0;
  const errors: string[] = [];
  for (const id of ids) {
    const res = await extractFromConversation(id);
    if (res.ok) total += res.count ?? 0;
    else errors.push(`convo ${id}: ${res.error}`);
  }
  return { processed: ids.length, totalMistakes: total, errors };
}

/** Placement test için — direkt hataları toplu insert (LLM'e gerek yok, cevaplar zaten belli) */
export async function recordPlacementMistakes(userId: number, wrong: Array<{
  questionId: string | number;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  explanation?: string;
  tags?: string[];
}>, cefrLevel: string | null): Promise<{ inserted: number }> {
  let inserted = 0;
  for (const w of wrong) {
    try {
      await pool.query(
        `INSERT INTO user_mistakes
           (user_id, mistake_type, wrong_text, correct_text, explanation, context,
            source_module, source_ref, cefr_tag, tags)
         VALUES ($1, 'grammar', $2, $3, $4, $5, 'placement_test', $6, $7, $8)`,
        [userId, w.userAnswer, w.correctAnswer, w.explanation ?? null, w.question,
         String(w.questionId), cefrLevel, Array.isArray(w.tags) ? w.tags : []],
      );
      inserted++;
    } catch {}
  }
  return { inserted };
}
