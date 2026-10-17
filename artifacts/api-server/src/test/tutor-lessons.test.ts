import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { pool } from "@workspace/db";

// Ders motorunun yapay zekâ çağrılarını kontrol edilebilir hâle getir (test env'de OpenAI anahtarı yok).
const mock = vi.hoisted(() => ({ aiOn: false, queue: [] as any[] }));
vi.mock("../lib/tutor-lesson-engine.js", async (importOriginal) => {
  const real: any = await importOriginal();
  return {
    ...real,
    aiAvailable: () => mock.aiOn,
    speak: async () => null,
    transcribeLearner: async () => ({ text: "Hi, I'm Ayşe.", seconds: 2 }),
    evaluateTurn: async () => {
      const next = mock.queue.shift();
      if (!next) throw new Error("test: kuyrukta değerlendirme yok");
      return next;
    },
  };
});

import { api, resetDb, closeDb, registerUser, createAdmin } from "./helpers.js";
import { TUTOR_LESSONS, seedTutorLessons } from "../lib/tutor-lessons-seed.js";
import { parseEvaluation, sanitizeGeneratedLesson, languageMixFor } from "../lib/tutor-lesson-engine.js";
import { validateLessonInput, slugify } from "../routes/admin-tutor-lessons.js";

const SLUG = "yabanci-musteriye-kendini-tanit";
const lessonSeed = TUTOR_LESSONS.find((l) => l.slug === SLUG)!;

beforeAll(async () => {
  await resetDb();
  await pool.query(`TRUNCATE tutor_lesson_turns, tutor_lesson_sessions, tutor_lessons RESTART IDENTITY CASCADE`);
  await pool.query(`TRUNCATE user_mistakes RESTART IDENTITY`);
  await seedTutorLessons();
});
afterAll(closeDb);

describe("saf mantık", () => {
  it("parseEvaluation: bozuk JSON → wrong; son denemede her zaman ilerler; markdown temizlenir", () => {
    expect(parseEvaluation("bu json değil", false)).toMatchObject({ verdict: "wrong", advance: false });
    expect(parseEvaluation("bu json değil", true).advance).toBe(true);
    const ok = parseEvaluation(JSON.stringify({ verdict: "correct", say: "**Harika!** Çok iyi.", advance: false }), false);
    expect(ok.advance).toBe(true); // correct her zaman ilerler
    expect(ok.say).toBe("Harika! Çok iyi.");
    const almost = parseEvaluation(JSON.stringify({
      verdict: "almost", say: "Neredeyse.", advance: true,
      correction: { original: "responsible of", corrected: "responsible for", whyTr: "for gelir" },
    }), false);
    expect(almost.correction?.corrected).toBe("responsible for");
    expect(parseEvaluation(JSON.stringify({ verdict: "uydurma", say: "x" }), false).verdict).toBe("wrong");
  });

  it("seviye dil karışımı A2'de Türkçe ağırlıklı, C1'de İngilizce", () => {
    expect(languageMixFor("A2")).toContain("%70");
    expect(languageMixFor("C1")).toContain("İngilizce konuş");
  });

  it("kişiye özel ders çıktısı doğrulanır; eksik adımlar atılır", () => {
    expect(sanitizeGeneratedLesson({ steps: [] })).toBeNull();
    const l = sanitizeGeneratedLesson({
      title: "Tekrar", steps: [
        { goalTr: "a", setupTr: "b", targets: ["I'm responsible for sales."] },
        { goalTr: "", setupTr: "b", targets: ["x"] },
        { goalTr: "c", setupTr: "d", targets: ["We apologize for the delay."] },
      ],
    });
    expect(l?.steps).toHaveLength(2);
  });

  it("seed metinlerinde hitap yok (kızım/canım/hayatım)", () => {
    const all = JSON.stringify(TUTOR_LESSONS).toLowerCase();
    for (const w of ["kızım", "canım", "hayatım", "tatlım"]) expect(all).not.toContain(w);
    for (const l of TUTOR_LESSONS) {
      expect(l.steps.length).toBeGreaterThanOrEqual(3);
      for (const s of l.steps) expect(s.targets.length).toBeGreaterThan(0);
    }
  });

  it("slugify Türkçe karakterleri çevirir; doğrulama adımları zorunlu tutar", () => {
    expect(slugify("Müşteri Şikâyeti Çöz")).toBe("musteri-sikayeti-coz");
    expect(validateLessonInput({ title: "x", steps: [] }, false).error).toBeTruthy();
    expect(validateLessonInput({ title: "x", steps: [{ goalTr: "a", setupTr: "b", targets: [] }] }, false).error).toContain("Adım 1");
    expect(validateLessonInput({ title: "x", levelMin: "C1", levelMax: "A2", steps: [{ goalTr: "a", setupTr: "b", targets: ["c"] }] }, false).error).toBeTruthy();
    expect(validateLessonInput({ isPublished: true }, true).value).toEqual({ isPublished: true });
  });
});

describe("öğrenci akışı", () => {
  let token: string;
  let userId: number;

  beforeAll(async () => {
    const r = await registerUser({ firstName: "Ayşe" });
    token = r.token!;
    userId = r.user.id;
    await pool.query(`UPDATE users SET current_level = 'B1' WHERE id = $1`, [userId]);
  });
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("giriş yoksa 401; kütüphane tüm yayımlı dersleri döner", async () => {
    expect((await api().get("/api/tutor/lessons")).status).toBe(401);
    const res = await api().get("/api/tutor/lessons").set(auth());
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.teacher.name).toBe("Merve");
    expect(res.body.lessons).toHaveLength(TUTOR_LESSONS.length);
    expect(res.body.lessons.some((l: any) => l.recommended)).toBe(true);
    expect(res.body.activeSession).toBeNull();
    expect(res.body.personalAvailable).toBe(false);
    expect(res.body.voice.available).toBe(false);
  });

  it("ders başlar: Merve adla selamlar, ilk adımın kurgusunu söyler (AI olmadan da)", async () => {
    const res = await api().post(`/api/tutor/lessons/${SLUG}/start`).set(auth()).send({});
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.reply.text).toContain("Merhaba Ayşe, ben Merve.");
    expect(res.body.reply.text).toContain(lessonSeed.steps[0].setupTr);
    expect(res.body.reply.audioBase64).toBeNull();
    expect(res.body.session).toMatchObject({ stepIndex: 0, totalSteps: lessonSeed.steps.length, status: "active" });
    expect(res.body.session.currentGoal).toBe(lessonSeed.steps[0].goalTr);
  });

  it("olmayan ders 404; AI kapalıyken cevap 503", async () => {
    expect((await api().post("/api/tutor/lessons/yok-boyle/start").set(auth())).status).toBe(404);
    const lib = await api().get("/api/tutor/lessons").set(auth());
    const sid = lib.body.activeSession.id;
    const res = await api().post(`/api/tutor/lesson-sessions/${sid}/turn`).set(auth()).send({ text: "Hi" });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("ai_unavailable");
  });

  it("tam ders: yanlış → aynı adım; doğru → sonraki adım; neredeyse → düzeltme + hata defteri; son adımda özet", async () => {
    mock.aiOn = true;
    const start = await api().post(`/api/tutor/lessons/${SLUG}/start`).set(auth()).send({});
    const sid = start.body.session.id;
    const turn = (text: string) => api().post(`/api/tutor/lesson-sessions/${sid}/turn?speak=0`).set(auth()).send({ text });

    // 1) yanlış → ilerlemez
    mock.queue.push({ verdict: "wrong", say: "Bir kez daha, İngilizce dener misin?", correction: null, advance: false });
    let r = await turn("Merhaba");
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.advanced).toBe(false);
    expect(r.body.session.stepIndex).toBe(0);

    // 2) doğru → adım 2, cevaba bir sonraki adımın kurgusu eklenir
    mock.queue.push({ verdict: "correct", say: "Çok iyi!", correction: null, advance: true });
    r = await turn("Hi, I'm Ayşe. Nice to meet you.");
    expect(r.body.session.stepIndex).toBe(1);
    expect(r.body.reply.text).toContain(lessonSeed.steps[1].setupTr);

    // 3) neredeyse → düzeltme kaydedilir
    mock.queue.push({
      verdict: "almost", say: "Neredeyse: responsible for.", advance: true,
      correction: { original: "responsible of", corrected: "responsible for", whyTr: "Responsible'dan sonra for gelir." },
    });
    r = await turn("I work at ABC as sales manager, responsible of export.");
    expect(r.body.correction.corrected).toBe("responsible for");
    expect(r.body.session.stepIndex).toBe(2);
    await new Promise((res) => setTimeout(res, 50));
    const { rows: m } = await pool.query(`SELECT source_module, correct_text FROM user_mistakes WHERE user_id = $1`, [userId]);
    expect(m).toEqual([{ source_module: "tutor_lesson", correct_text: "responsible for" }]);

    // 4–5) kalan adımlar
    for (let i = 2; i < lessonSeed.steps.length; i++) {
      mock.queue.push({ verdict: "correct", say: "Harika.", correction: null, advance: true });
      r = await turn("Good sentence");
    }
    expect(r.body.completed).toBe(true);
    expect(r.body.reply.text).toContain(lessonSeed.outroTr);
    expect(r.body.summary).toMatchObject({ completed: true, stepsDone: lessonSeed.steps.length, totalSteps: lessonSeed.steps.length });
    expect(r.body.summary.corrections).toHaveLength(1);
    expect(r.body.summary.learned[0].phrase).toBe(lessonSeed.steps[0].targets[0]);

    // bitmiş derse cevap → 409
    mock.queue.push({ verdict: "correct", say: "x", correction: null, advance: true });
    expect((await turn("again")).status).toBe(409);
    mock.queue.length = 0;

    // puan
    await new Promise((res) => setTimeout(res, 100));
    const { rows: p } = await pool.query(
      `SELECT source, SUM(amount)::int AS n FROM points_events WHERE user_id = $1 AND source LIKE 'tutor_lesson%' GROUP BY source`,
      [userId],
    );
    const bySource = Object.fromEntries(p.map((x: any) => [x.source, x.n]));
    expect(bySource.tutor_lesson_complete).toBe(15);
    expect(bySource.tutor_lesson_turn).toBeGreaterThan(0);

    // oturum geçmişi
    const g = await api().get(`/api/tutor/lesson-sessions/${sid}`).set(auth());
    expect(g.body.turns.filter((t: any) => t.role === "user")).toHaveLength(lessonSeed.steps.length + 1);
    expect(g.body.summary.completed).toBe(true);
  });

  it("yanlış cevaplarda adım değişmez, deneme sayısı artar (3. deneme motorda 'son deneme' olur)", async () => {
    const start = await api().post(`/api/tutor/lessons/${SLUG}/start`).set(auth()).send({});
    const sid = start.body.session.id;
    const turn = () => api().post(`/api/tutor/lesson-sessions/${sid}/turn?speak=0`).set(auth()).send({ text: "???" });
    mock.queue.push({ verdict: "wrong", say: "a", correction: null, advance: false });
    mock.queue.push({ verdict: "wrong", say: "b", correction: null, advance: false });
    await turn();
    await turn();
    const { rows } = await pool.query(`SELECT step_attempts, current_step FROM tutor_lesson_sessions WHERE id = $1`, [sid]);
    expect(rows[0]).toEqual({ step_attempts: 2, current_step: 0 });
  });

  it("yeni ders başlatınca önceki aktif ders yarım kalmış sayılır; tek aktif oturum", async () => {
    await api().post(`/api/tutor/lessons/telefonda-tedarikci/start`).set(auth()).send({});
    const { rows } = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active FROM tutor_lesson_sessions WHERE user_id = $1`,
      [userId],
    );
    expect(rows[0].active).toBe(1);
  });

  it("başkasının oturumuna erişilemez", async () => {
    const other = await registerUser();
    const { rows } = await pool.query(`SELECT id FROM tutor_lesson_sessions WHERE user_id = $1 LIMIT 1`, [userId]);
    const res = await api().get(`/api/tutor/lesson-sessions/${rows[0].id}`).set("Authorization", `Bearer ${other.token}`);
    expect(res.status).toBe(404);
  });

  it("sesli kota dolunca ses kaydı 429 döner (yazıyla devam edilebilir)", async () => {
    process.env.TUTOR_DAILY_VOICE_TURNS = "0";
    try {
      const lib = await api().get("/api/tutor/lessons").set(auth());
      const sid = lib.body.activeSession.id;
      const res = await api()
        .post(`/api/tutor/lesson-sessions/${sid}/turn`)
        .set(auth())
        .attach("audio", Buffer.alloc(4000, 1), { filename: "speech.webm", contentType: "audio/webm" });
      expect(res.status).toBe(429);
      expect(res.body.code).toBe("voice_quota");
    } finally {
      delete process.env.TUTOR_DAILY_VOICE_TURNS;
    }
  });

  it("kişiye özel ders: hata defteri yetersizse 400", async () => {
    const fresh = await registerUser();
    const res = await api().post("/api/tutor/lessons/personal/start").set("Authorization", `Bearer ${fresh.token}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("no_mistakes");
  });
});

describe("admin", () => {
  it("öğrenci admin uçlarına giremez", async () => {
    const { token } = await registerUser();
    expect((await api().get("/api/admin/tutor-lessons").set("Authorization", `Bearer ${token}`)).status).toBe(403);
  });

  it("oluştur (taslak → öğrenci görmez) → yayımla → öğrenci görür → sil", async () => {
    const { token } = await createAdmin();
    const auth = { Authorization: `Bearer ${token}` };
    const created = await api().post("/api/admin/tutor-lessons").set(auth).send({
      title: "Fuarda stant ziyaretçisini karşıla", category: "satis", levelMin: "A2", levelMax: "B2",
      steps: [{ goalTr: "Selam ver", setupTr: "Standa biri geldi.", targets: ["Hello, welcome to our stand!"] }],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.lesson.slug).toBe("fuarda-stant-ziyaretcisini-karsila");
    expect(created.body.lesson.isPublished).toBe(false);

    const student = await registerUser();
    const sAuth = { Authorization: `Bearer ${student.token}` };
    let lib = await api().get("/api/tutor/lessons").set(sAuth);
    expect(lib.body.lessons.some((l: any) => l.slug === created.body.lesson.slug)).toBe(false);

    await api().patch(`/api/admin/tutor-lessons/${created.body.lesson.id}`).set(auth).send({ isPublished: true });
    lib = await api().get("/api/tutor/lessons").set(sAuth);
    expect(lib.body.lessons.some((l: any) => l.slug === created.body.lesson.slug)).toBe(true);

    const dup = await api().post("/api/admin/tutor-lessons").set(auth).send({
      title: "Fuarda stant ziyaretçisini karşıla",
      steps: [{ goalTr: "a", setupTr: "b", targets: ["c"] }],
    });
    expect(dup.status).toBe(409);

    expect((await api().delete(`/api/admin/tutor-lessons/${created.body.lesson.id}`).set(auth)).status).toBe(200);
  });

  it("admin'in düzenlediği seed dersi açılış seed'iyle ezilmez; dokunulmamış olan güncellenir", async () => {
    const { token } = await createAdmin();
    const auth = { Authorization: `Bearer ${token}` };
    const { rows: [l] } = await pool.query(`SELECT id FROM tutor_lessons WHERE slug = $1`, [SLUG]);
    await api().patch(`/api/admin/tutor-lessons/${l.id}`).set(auth).send({ title: "Admin başlığı" });
    await pool.query(`UPDATE tutor_lessons SET title = 'Eski başlık' WHERE slug = 'telefonda-tedarikci'`); // updated_at değişmez
    await seedTutorLessons();
    const { rows } = await pool.query(`SELECT slug, title FROM tutor_lessons WHERE slug IN ($1, 'telefonda-tedarikci') ORDER BY slug`, [SLUG]);
    const by = Object.fromEntries(rows.map((r: any) => [r.slug, r.title]));
    expect(by[SLUG]).toBe("Admin başlığı");
    expect(by["telefonda-tedarikci"]).toBe(TUTOR_LESSONS.find((x) => x.slug === "telefonda-tedarikci")!.title);

    const list = await api().get("/api/admin/tutor-lessons").set(auth);
    expect(list.body.lessons.find((x: any) => x.slug === SLUG).edited).toBe(true);
    const ov = await api().get("/api/admin/tutor-lessons/overview").set(auth);
    expect(ov.status).toBe(200);
    expect(ov.body.totals.sessions).toBeGreaterThan(0);
  });
});
