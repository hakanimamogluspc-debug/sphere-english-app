import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, registerUser, createAdmin } from "./helpers.js";
import { splitSegments, pauseBefore, deliveryText, getVoiceSettings, ensureVoiceTables, explainElevenError } from "../lib/tutor-voice.js";

describe("ElevenLabs hata açıklaması", () => {
  it("bilinen hataları Türkçe yönlendirmeye çevirir", () => {
    expect(explainElevenError(404, JSON.stringify({ detail: { status: "voice_not_found", message: "Voice not found" } }))).toContain("Add to my voices");
    expect(explainElevenError(401, JSON.stringify({ detail: { status: "quota_exceeded", message: "quota exceeded" } }))).toContain("kota");
    expect(explainElevenError(401, JSON.stringify({ detail: { status: "missing_permissions", message: "missing permission text_to_speech" } }))).toContain("izni");
    expect(explainElevenError(401, "Unauthorized")).toContain("geçersiz");
    expect(explainElevenError(402, "")).toContain("ücretli plan");
  });
});

beforeAll(async () => {
  await resetDb();
  await ensureVoiceTables();
  await pool.query(`TRUNCATE tutor_settings, tutor_tts_cache`);
});
afterAll(closeDb);

describe("konuşmayı parçalara ayırma", () => {
  it("tırnak içindeki İngilizce cümle ayrı parça; Türkçe akış korunur", () => {
    const segs = splitSegments([{ text: 'Neredeyse. Doğrusu: "I\'m responsible for sales." Hadi bir daha.' }]);
    expect(segs.map((s) => [s.lang, s.text])).toEqual([
      ["tr", "Neredeyse. Doğrusu:"],
      ["en", "I'm responsible for sales."],
      ["tr", "Hadi bir daha."],
    ]);
  });

  it("tek kelimelik ya da Türkçe karakterli tırnaklar İngilizce sayılmaz", () => {
    const segs = splitSegments([{ text: '"No" kelimesi tehlikeli. "Merhaba dünya" dedi.' }]);
    expect(segs).toHaveLength(1);
    expect(segs[0].lang).toBe("tr");
  });

  it("parçalar ayrı tutulur; önbellek bilgisi taşınır; boş parçalar atılır", () => {
    const segs = splitSegments([{ text: "Çok iyi!" }, { text: "" }, { text: "Şimdi sebebini söyle.", cacheable: true }]);
    expect(segs).toHaveLength(2);
    expect(segs[1]).toMatchObject({ part: 2, cacheable: true });
  });

  it("duraklamalar: İngilizce çevresinde ayarlanan süre, parça geçişinde daha uzun", () => {
    const st = { pauseAroundEnglishMs: 450, pauseBetweenPartsMs: 600 };
    const [a, b, c] = splitSegments([{ text: 'Şöyle de: "Thank you for your patience." Güzel.' }]);
    expect(pauseBefore(undefined, a, st)).toBe(0);
    expect(pauseBefore(a, b, st)).toBe(450);
    expect(pauseBefore(b, c, st)).toBe(450);
    const [x, y] = splitSegments([{ text: "Harika." }, { text: "Sonraki adım." }]);
    expect(pauseBefore(x, y, st)).toBe(600);
  });

  it("v4'te ton etiketi eklenir, v2'de ve OpenAI'de eklenmez; İngilizce cümle noktayla biter", () => {
    const en = { lang: "en" as const, text: "Could I try one size bigger", part: 0, cacheable: false };
    expect(deliveryText(en, { elevenModel: "eleven_v4", deliveryTags: true }, "elevenlabs")).toMatch(/^\[.*\] Could I try one size bigger\.$/);
    expect(deliveryText(en, { elevenModel: "eleven_multilingual_v2", deliveryTags: true }, "elevenlabs")).toBe("Could I try one size bigger.");
    expect(deliveryText(en, { elevenModel: "eleven_v4", deliveryTags: true }, "openai")).toBe("Could I try one size bigger.");
  });
});

describe("admin — Merve'nin sesi", () => {
  it("öğrenci giremez", async () => {
    const { token } = await registerUser();
    expect((await api().get("/api/admin/tutor-voice").set("Authorization", `Bearer ${token}`)).status).toBe(403);
  });

  it("anahtar yokken OpenAI'de kalır; ayar kaydedilir ve okunur; örnek ses anahtarsız 502", async () => {
    const { token } = await createAdmin();
    const auth = { Authorization: `Bearer ${token}` };
    const g = await api().get("/api/admin/tutor-voice").set(auth);
    expect(g.status).toBe(200);
    expect(g.body.settings.provider).toBe("openai");
    expect(g.body.elevenAvailable).toBe(false);
    expect(g.body.sample).toContain('"');

    const p = await api().patch("/api/admin/tutor-voice").set(auth).send({ speed: 0.9, pauseAroundEnglishMs: 700, elevenVoiceId: "abc123", bogus: 1 });
    expect(p.status).toBe(200);
    expect(p.body.settings).toMatchObject({ speed: 0.9, pauseAroundEnglishMs: 700, elevenVoiceId: "abc123" });
    // ElevenLabs anahtarı olmadan ses seçilmiş olsa da sağlayıcı OpenAI kalır
    expect(p.body.settings.provider).toBe("openai");
    expect((await getVoiceSettings(true)).speed).toBe(0.9);

    expect((await api().patch("/api/admin/tutor-voice").set(auth).send({ nothing: true })).status).toBe(400);
    expect((await api().post("/api/admin/tutor-voice/preview").set(auth).send({})).status).toBe(502);

    const c = await api().post("/api/admin/tutor-voice/clear-cache").set(auth);
    expect(c.body.cache.entries).toBe(0);
  });
});
