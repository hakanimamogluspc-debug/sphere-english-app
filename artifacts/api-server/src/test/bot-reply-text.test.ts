import { describe, it, expect } from "vitest";
import { finalizeBotReply } from "../lib/bot-reply-text.js";

describe("bot cevabı yarıda kesilirse", () => {
  it("yarım kalan linki ve tamamlanmamış cümleyi atar", () => {
    expect(finalizeBotReply("Sunum kitabı ₺249. Buradan bakabilirsin: https://www.sphereenglish.com/e-kitaplar/sun", "length"))
      .toBe("Sunum kitabı ₺249.");
    expect(finalizeBotReply("Uygulama ücretsiz! Kitap için şu linke", "length")).toBe("Uygulama ücretsiz!");
  });

  it("tamamlanmış cevaba dokunmaz", () => {
    const t = "Kitap burada: https://www.sphereenglish.com/e-kitaplar/sunum";
    expect(finalizeBotReply(t, "stop")).toBe(t);
  });
});
