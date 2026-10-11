/**
 * Reactivation email — tek seferlik, mevcut inactive user'lara.
 *
 * Çalıştırma:
 *   # Dry run (hiç mail göndermez, kime gidecek listeler):
 *   REACTIVATION_DRY=1 artifacts/api-server/node_modules/.bin/tsx \
 *     artifacts/api-server/scripts/send-reactivation-email.ts
 *
 *   # Gerçek gönderim:
 *   artifacts/api-server/node_modules/.bin/tsx \
 *     artifacts/api-server/scripts/send-reactivation-email.ts
 *
 *   # Belirli bir mail'e TEST olarak gönder:
 *   REACTIVATION_TEST_TO=hakan@gmail.com artifacts/api-server/node_modules/.bin/tsx \
 *     artifacts/api-server/scripts/send-reactivation-email.ts
 *
 * Kime gider:
 *   role=student VE (last_active_date NULL VEYA 7+ gün önce)
 *   Admin, teacher, corporate roleleri hariç.
 */
import { db, usersTable } from "@workspace/db";
import { and, eq, or, isNull, sql } from "drizzle-orm";
import { sendEmail } from "../src/lib/email.js";

const APP_URL = process.env.APP_URL || "https://app.sphereenglish.com";

function mailHtml(firstName: string): string {
  const name = firstName || "merhaba";
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sphere English</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1e3a6e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(30,58,110,0.08);">
          <!-- Header gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a6e 0%,#0e7da6 100%);padding:28px 32px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.15em;text-transform:uppercase;opacity:0.85;margin-bottom:8px;">Sphere English</div>
              <div style="font-size:24px;font-weight:800;line-height:1.3;">Merhaba ${escapeHtml(name)}, seni özledik 👋</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;line-height:1.6;font-size:15px;color:#1e3a6e;">
              <p style="margin:0 0 16px;">
                Platforma kaydolup seviye testini yaptıktan sonra bir süredir seni görmedik.
                Ama güzel haber: <strong>çok şey eklendi!</strong>
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#f5f7fb;border-radius:12px;padding:16px;">
                <tr>
                  <td style="padding:8px;">
                    <div style="font-size:13px;font-weight:700;color:#1e3a6e;margin-bottom:4px;">📚 1400 kelimelik yeni kelime çalışma modülü</div>
                    <div style="font-size:13px;color:#64748b;">Her kelimede IPA telaffuz, örnek cümle, eş anlamlı. Keşfet → favori ekle → günlük tekrar.</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px;">
                    <div style="font-size:13px;font-weight:700;color:#1e3a6e;margin-bottom:4px;">🎯 Günlük tekrar (SRS algoritması)</div>
                    <div style="font-size:13px;color:#64748b;">Beyin bilimine dayalı aralıklı tekrar — Duolingo stili ama iş İngilizcesi için.</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px;">
                    <div style="font-size:13px;font-weight:700;color:#1e3a6e;margin-bottom:4px;">🗣️ Konuşma koçu, mülakat simülatörü, sunum simülatörü</div>
                    <div style="font-size:13px;color:#64748b;">Gerçek iş senaryolarında AI ile konuşma pratiği.</div>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="${APP_URL}/m/pratik/kelime-hub"
                       style="display:inline-block;background:#1e3a6e;color:#ffffff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
                      Hemen 5 dakika pratik yap →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.5;">
                Günde 5 dakika yeterli. Bir şey yapamadığın gün bile 10 kelime tekrarı seviyene katkı yapar.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#f5f7fb;border-top:1px solid #e2e8f0;text-align:center;">
              <div style="font-size:11px;color:#94a3b8;line-height:1.5;">
                Bu e-posta <a href="${APP_URL}" style="color:#0e7da6;text-decoration:none;">${APP_URL.replace(/^https?:\/\//, "")}</a> hesabına gönderildi.<br>
                Soruların için <a href="mailto:info@sphereenglish.com" style="color:#0e7da6;text-decoration:none;">info@sphereenglish.com</a> adresine yazabilirsin.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function run() {
  const dry = process.env.REACTIVATION_DRY === "1";
  const testTo = process.env.REACTIVATION_TEST_TO;

  if (testTo) {
    console.log(`[test] Tek test maili → ${testTo}`);
    const html = mailHtml("Test");
    const res = await sendEmail(testTo, "Sphere English seni özledi 👋", html);
    console.log(res.ok ? "✓ Gönderildi" : `✗ Hata: ${res.error}`);
    process.exit(res.ok ? 0 : 1);
  }

  // Kime gidecek: student rolü, hiç aktif olmamış veya 7+ gün aktif değil
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const users = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    firstName: usersTable.firstName,
    lastActiveDate: usersTable.lastActiveDate,
    createdAt: usersTable.createdAt,
  })
    .from(usersTable)
    .where(and(
      eq(usersTable.role, "student"),
      or(
        isNull(usersTable.lastActiveDate),
        sql`${usersTable.lastActiveDate} < ${sevenDaysAgoStr}`,
      ),
    ));

  console.log(`[reactivation] ${users.length} inactive student bulundu`);

  if (dry) {
    console.log("\n[DRY RUN] — Mail gönderilmeyecek. Liste:");
    users.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.email} (${u.firstName || "—"})  kayıt=${u.createdAt?.toISOString?.().split("T")[0] || "?"}  son_aktif=${u.lastActiveDate || "hiç"}`);
    });
    console.log(`\nGerçek göndermek için REACTIVATION_DRY değerini kaldır ve tekrar çalıştır.`);
    process.exit(0);
  }

  let sent = 0, failed = 0;
  for (const u of users) {
    const html = mailHtml(u.firstName || "");
    const res = await sendEmail(u.email, "Sphere English seni özledi 👋", html);
    if (res.ok) {
      sent++;
      console.log(`  ✓ ${u.email}`);
    } else {
      failed++;
      console.log(`  ✗ ${u.email}: ${res.error}`);
    }
    // Rate limit: 500ms ara (provider spam filtre'si tetiklenmesin)
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(`\n[done] ${sent} gönderildi, ${failed} başarısız`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
