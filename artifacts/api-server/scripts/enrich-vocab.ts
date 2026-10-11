/**
 * Enrich vocab_words with pronunciation (IPA), partOfSpeech, example
 * sentences, synonyms. Uses OpenAI gpt-4o-mini.
 *
 * Idempotent: only processes rows where pronunciation IS NULL.
 *
 * Çalıştırma (Easypanel sphere-api container shell):
 *   cd /app && node_modules/.bin/tsx artifacts/api-server/scripts/enrich-vocab.ts
 *
 * Opsiyonel ENV:
 *   VOCAB_ENRICH_LIMIT   → bir çalıştırmada en fazla kaç kelime (default: hepsi)
 *   VOCAB_ENRICH_BATCH   → paralel batch size (default: 10)
 *   VOCAB_ENRICH_DRY     → "1" ise DB'ye yazmaz, sadece log basar
 *   VOCAB_ENRICH_LEVEL   → sadece bu CEFR seviyesini (A1/A2/B1/B2/C1)
 */
import { db, vocabWordsTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface EnrichedWord {
  pronunciation: string;           // IPA
  partOfSpeech: string;            // noun | verb | adjective | ...
  exampleSentence: string;         // English
  exampleSentenceTurkish: string;  // Turkish translation
  synonyms: string[];              // up to 3
}

const PROMPT = (word: string, turkish: string, category: string, level: string) => `
You are an English language learning content expert. Return JSON for the given English word.

Word: "${word}"
Turkish meaning: "${turkish}"
Category: ${category}
CEFR level: ${level}

Return ONLY valid JSON matching this shape:
{
  "pronunciation": "IPA pronunciation (e.g. /ˈæpəl/)",
  "partOfSpeech": "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "interjection" | "phrase",
  "exampleSentence": "A natural English sentence using the word, 8-15 words, appropriate for CEFR ${level}",
  "exampleSentenceTurkish": "Natural Turkish translation of exampleSentence",
  "synonyms": ["up to 3 English synonyms"]
}

Rules:
- IPA must use proper International Phonetic Alphabet symbols
- exampleSentence must contain the word (any inflection OK)
- Keep the sentence natural, appropriate for a ${category} learning context
- Synonyms must be real synonyms, not related words
`;

async function enrichOne(word: {
  id: number; word: string; turkish: string; category: string; level: string;
}): Promise<EnrichedWord | null> {
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a precise English language expert. Return only valid JSON." },
        { role: "user", content: PROMPT(word.word, word.turkish, word.category, word.level) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 300,
    });
    const content = resp.choices[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as EnrichedWord;
    // Validate
    if (!parsed.pronunciation || !parsed.partOfSpeech || !parsed.exampleSentence) {
      console.warn(`[skip] ${word.word}: invalid shape`);
      return null;
    }
    if (!Array.isArray(parsed.synonyms)) parsed.synonyms = [];
    return parsed;
  } catch (e: any) {
    console.warn(`[err] ${word.word}: ${e?.message}`);
    return null;
  }
}

async function run() {
  const limit = Number(process.env.VOCAB_ENRICH_LIMIT || "0");
  const batchSize = Math.max(1, Number(process.env.VOCAB_ENRICH_BATCH || "10"));
  const dry = process.env.VOCAB_ENRICH_DRY === "1";
  const levelFilter = process.env.VOCAB_ENRICH_LEVEL;

  const conds = [isNull(vocabWordsTable.pronunciation)];
  if (levelFilter) conds.push(eq(vocabWordsTable.level, levelFilter));

  let query = db.select({
    id: vocabWordsTable.id,
    word: vocabWordsTable.word,
    turkish: vocabWordsTable.turkish,
    category: vocabWordsTable.category,
    level: vocabWordsTable.level,
  })
    .from(vocabWordsTable)
    .where(and(...conds));

  const words = await query;
  const toProcess = limit > 0 ? words.slice(0, limit) : words;

  console.log(`[enrich] ${toProcess.length} kelime işlenecek (toplam eksik: ${words.length})`);
  if (dry) console.log("[DRY RUN] DB'ye yazılmayacak");

  let done = 0, failed = 0;
  for (let i = 0; i < toProcess.length; i += batchSize) {
    const batch = toProcess.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (w) => {
      const enriched = await enrichOne(w);
      return { w, enriched };
    }));

    for (const { w, enriched } of results) {
      if (!enriched) { failed++; continue; }
      if (!dry) {
        try {
          await db.update(vocabWordsTable).set({
            pronunciation: enriched.pronunciation,
            partOfSpeech: enriched.partOfSpeech,
            exampleSentence: enriched.exampleSentence,
            exampleSentenceTurkish: enriched.exampleSentenceTurkish,
            synonyms: enriched.synonyms.slice(0, 5),
            updatedAt: new Date(),
          }).where(eq(vocabWordsTable.id, w.id));
        } catch (e: any) {
          console.warn(`[db-err] ${w.word}: ${e?.message}`);
          failed++;
          continue;
        }
      }
      done++;
      if (done % 25 === 0) console.log(`  ✓ ${done}/${toProcess.length}  (last: ${w.word} → ${enriched.pronunciation})`);
    }
  }

  console.log(`\n[done] ${done} enriched, ${failed} failed, ${toProcess.length - done - failed} skipped`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
