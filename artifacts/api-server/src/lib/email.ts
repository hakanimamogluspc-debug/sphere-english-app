import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

export function createEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const secure = port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false, ciphers: "SSLv3" },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  } as any);
}

export function loadEmailTemplate(filename: string): string | null {
  const filePath = path.join(process.cwd(), "public", "templates", filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

export function applyTemplateVars(html: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, val]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val),
    html
  );
}

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const transporter = createEmailTransporter();
  if (!transporter) return { ok: false, error: "SMTP yapılandırılmamış" };
  const from = `Sphere English <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
  try {
    await transporter.sendMail({ from, to, subject, html });
    return { ok: true };
  } catch (e: any) {
    console.error("sendEmail error:", e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}
