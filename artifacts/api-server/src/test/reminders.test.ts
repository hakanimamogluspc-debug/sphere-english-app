import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { api, resetDb, closeDb, registerUser, createAdmin } from "./helpers.js";
import { TEST_INTERNAL_TOKEN } from "./test-env.js";
import { pickTouch, pickVariant, renderComeback, renderStreakRisk, COMEBACK_TOUCHES } from "../lib/reminder-sequence.js";

beforeAll(async () => {
  await resetDb();
  await pool.query(`TRUNCATE notification_log RESTART IDENTITY`);
});
afterAll(closeDb);

const run = () =>
  api().post("/api/internal/notifications/run-daily-reminders?type=comeback").set("x-internal-token", TEST_INTERNAL_TOKEN);

async function makeInactiveUser(daysAgo: number) {
  const { user } = await registerUser();
  await pool.query(`UPDATE users SET last_active_date = CURRENT_DATE - $2::int, streak = 0 WHERE id = $1`, [user.id, daysAgo]);
  return user.id as number;
}

describe("dokunuş seçimi (saf mantık)", () => {
  it("inaktif gün → doğru dokunuş; 3 günden az ve 75'ten çok → yok", () => {
    expect(pickTouch(0)).toBeNull();
    expect(pickTouch(2)).toBeNull();
    expect(pickTouch(3)?.key).toBe("comeback_3");
    expect(pickTouch(6)?.key).toBe("comeback_3");
    expect(pickTouch(7)?.key).toBe("comeback_7");
    expect(pickTouch(13)?.key).toBe("comeback_7");
    expect(pickTouch(14)?.key).toBe("comeback_14");
    expect(pickTouch(29)?.key).toBe("comeback_14");
    expect(pickTouch(30)?.key).toBe("comeback_30");
    expect(pickTouch(60)?.key).toBe("comeback_60");
    expect(pickTouch(75)?.key).toBe("comeback_60");
    expect(pickTouch(76)).toBeNull();
  });

  it("varyant kullanıcıya göre deterministik; her dokunuşun A ve B konusu farklı", () => {
    expect(pickVariant(2)).toBe("A");
    expect(pickVariant(3)).toBe("B");
    const u = { id: 1, firstName: "Ayşe", email: "a@b.c", inactiveDays: 7, level: "B1", learningGoal: "customer", sector: null, dueVocab: 12, topModule: "vocab_game", totalMinutes30: 40 };
    for (const t of COMEBACK_TOUCHES) {
      const a = renderComeback(t, { ...u, inactiveDays: t.day }, "A", "https://app.test");
      const b = renderComeback(t, { ...u, inactiveDays: t.day }, "B", "https://app.test");
      expect(a.subject).not.toBe(b.subject);
      expect(a.html).toContain("Ayşe");
      expect(a.html).toContain(`utm_campaign=${t.key}`);
      expect(a.html).toContain("bildirim tercihlerinden");
    }
  });

  it("kişiselleştirme: 7. gün maili tekrar bekleyen kelime sayısını kullanır", () => {
    const base = { id: 2, firstName: "Mehmet", email: "m@b.c", inactiveDays: 7, level: "A2", learningGoal: null, sector: null, dueVocab: 23, topModule: null, totalMinutes30: 0 };
    const withDue = renderComeback(COMEBACK_TOUCHES[1], base, "A", "https://app.test");
    expect(withDue.subject).toContain("23 kelime");
    expect(withDue.ctaPath).toBe("/student/vocab-hub");
    const noDue = renderComeback(COMEBACK_TOUCHES[1], { ...base, dueVocab: 0 }, "A", "https://app.test");
    expect(noDue.subject).not.toContain("kelime unutulmak");
    expect(noDue.ctaPath).toBe("/student/vocab-game");
  });

  it("HTML kaçışı: isimde < > varsa ham basılmaz", () => {
    const m = renderComeback(COMEBACK_TOUCHES[0], { id: 1, firstName: "<img src=x>", email: "x", inactiveDays: 3, level: null, learningGoal: null, sector: null, dueVocab: 0, topModule: null, totalMinutes30: 0 }, "A", "https://app.test");
    expect(m.html).not.toContain("<img src=x>");
    expect(m.html).toContain("&lt;img");
  });

  it("streak maili haftanın gününe göre 3 farklı tonda", () => {
    const subs = new Set([0, 1, 2].map((d) => renderStreakRisk("Ali", 5, "https://app.test", d).subject));
    expect(subs.size).toBe(3);
  });
});

describe("POST /internal/notifications/run-daily-reminders?type=comeback", () => {
  it("token yoksa 401", async () => {
    expect((await api().post("/api/internal/notifications/run-daily-reminders?type=comeback")).status).toBe(401);
  });

  it("inaktif gün sayısına göre doğru dokunuş gönderilir; 2 günlük ve aktif kullanıcıya gitmez", async () => {
    const u3 = await makeInactiveUser(3);
    const u9 = await makeInactiveUser(9);
    const u40 = await makeInactiveUser(40);
    const u2 = await makeInactiveUser(2);
    const uActive = await makeInactiveUser(0);
    const u200 = await makeInactiveUser(200);

    const res = await run();
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.sent).toBe(3);

    const { rows } = await pool.query(`SELECT user_id, type, variant, touch_day, status FROM notification_log WHERE channel = 'email' ORDER BY user_id`);
    const byUser = Object.fromEntries(rows.map((r: any) => [r.user_id, r]));
    expect(byUser[u3].type).toBe("comeback_3");
    expect(byUser[u9].type).toBe("comeback_7");
    expect(byUser[u40].type).toBe("comeback_30");
    expect(byUser[u40].touch_day).toBe(30);
    expect(["A", "B"]).toContain(byUser[u3].variant);
    expect(byUser[u2]).toBeUndefined();
    expect(byUser[uActive]).toBeUndefined();
    expect(byUser[u200]).toBeUndefined();
  });

  it("aynı dönemde aynı dokunuş ikinci kez gönderilmez (idempotent)", async () => {
    const before = (await pool.query(`SELECT COUNT(*)::int AS n FROM notification_log`)).rows[0].n;
    const res = await run();
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(0);
    const after = (await pool.query(`SELECT COUNT(*)::int AS n FROM notification_log`)).rows[0].n;
    expect(after).toBe(before);
  });

  it("kullanıcı bir sonraki eşiğe geçince yeni dokunuş gider, ama 2 gün içinde üst üste gitmez", async () => {
    const u = await makeInactiveUser(3);
    await run(); // comeback_3 bugün gitti
    // Zamanı ileri sar: kullanıcı artık 7 gün inaktif, önceki mail 4 gün önce gitmiş gibi
    await pool.query(`UPDATE users SET last_active_date = CURRENT_DATE - 7 WHERE id = $1`, [u]);
    await pool.query(`UPDATE notification_log SET sent_date = CURRENT_DATE - 4 WHERE user_id = $1`, [u]);
    const r = await run();
    const { rows } = await pool.query(`SELECT type FROM notification_log WHERE user_id = $1 ORDER BY id`, [u]);
    expect(rows.map((x: any) => x.type)).toEqual(["comeback_3", "comeback_7"]);
    expect(r.body.sent).toBeGreaterThanOrEqual(1);

    // Dün mail gitmişse bugün yeni eşik olsa da beklenir
    const v = await makeInactiveUser(14);
    await pool.query(
      `INSERT INTO notification_log (user_id, type, channel, status, sent_date) VALUES ($1, 'comeback_7', 'email', 'sent', CURRENT_DATE - 1)`,
      [v],
    );
    await run();
    const { rows: vr } = await pool.query(`SELECT type FROM notification_log WHERE user_id = $1`, [v]);
    expect(vr.map((x: any) => x.type)).toEqual(["comeback_7"]);
  });

  it("geri dönen kullanıcı dizide sıfırdan başlar", async () => {
    const u = await makeInactiveUser(8);
    await run(); // comeback_7
    // Geri döndü (bugün aktif), sonra 3 gün sonra yine kayboldu → mail tarihi 6 gün öncesine, aktiflik 3 gün önceye
    await pool.query(`UPDATE notification_log SET sent_date = CURRENT_DATE - 6 WHERE user_id = $1`, [u]);
    await pool.query(`UPDATE users SET last_active_date = CURRENT_DATE - 3 WHERE id = $1`, [u]);
    await run();
    const { rows } = await pool.query(`SELECT type FROM notification_log WHERE user_id = $1 ORDER BY id`, [u]);
    expect(rows.map((x: any) => x.type)).toEqual(["comeback_7", "comeback_3"]);
  });

  it("bildirim tercihi kapalıysa gönderilmez", async () => {
    const u = await makeInactiveUser(5);
    await pool.query(`INSERT INTO notification_preferences (user_id, inactivity_email) VALUES ($1, false) ON CONFLICT (user_id) DO UPDATE SET inactivity_email = false`, [u]);
    await run();
    const { rows } = await pool.query(`SELECT 1 FROM notification_log WHERE user_id = $1`, [u]);
    expect(rows).toHaveLength(0);
  });

  it("geri dönüş ölçümü: mailden sonra giriş yapan returned_days alır, 7 günü aşan almaz", async () => {
    const u = await makeInactiveUser(4);
    await run();
    // 5 gün önce gönderilmiş gibi yap, kullanıcı 2 gün önce dönmüş
    await pool.query(`UPDATE notification_log SET sent_date = CURRENT_DATE - 5 WHERE user_id = $1`, [u]);
    await pool.query(`UPDATE users SET last_active_date = CURRENT_DATE - 2 WHERE id = $1`, [u]);
    await run(); // markReturns koşar
    const { rows } = await pool.query(`SELECT returned_days FROM notification_log WHERE user_id = $1`, [u]);
    expect(rows[0].returned_days).toBe(3);

    const w = await makeInactiveUser(4);
    await run();
    await pool.query(`UPDATE notification_log SET sent_date = CURRENT_DATE - 20 WHERE user_id = $1`, [w]);
    await pool.query(`UPDATE users SET last_active_date = CURRENT_DATE - 2 WHERE id = $1`, [w]);
    await run();
    const { rows: wr } = await pool.query(`SELECT returned_at FROM notification_log WHERE user_id = $1`, [w]);
    expect(wr[0].returned_at).toBeNull();
  });
});

describe("admin istatistik + önizleme", () => {
  it("öğrenci giremez, admin dokunuş tablosunu görür", async () => {
    const { token } = await registerUser();
    expect((await api().get("/api/admin/notifications/reminder-stats").set("Authorization", `Bearer ${token}`)).status).toBe(403);
    const admin = await createAdmin();
    const res = await api().get("/api/admin/notifications/reminder-stats?days=30").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.touches).toHaveLength(5);
    expect(Array.isArray(res.body.byTouch)).toBe(true);
    expect(res.body.recent.length).toBeGreaterThan(0);
  });

  it("önizleme her dokunuş için HTML döner", async () => {
    const admin = await createAdmin();
    for (const key of [...COMEBACK_TOUCHES.map((t) => t.key), "streak_risk"]) {
      const res = await api().get(`/api/admin/notifications/reminder-preview?touch=${key}&variant=B`).set("Authorization", `Bearer ${admin.token}`);
      expect(res.status, key).toBe(200);
      expect(res.text).toContain("<!-- subject:");
      expect(res.text).toContain("Ayşe");
    }
  });
});
