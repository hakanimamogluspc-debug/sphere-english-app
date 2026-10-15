import express, { type Express } from "express";
import { metricsMiddleware } from "./lib/metrics.js";
import { appEnv, isStaging } from "./lib/app-env.js";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import router from "./routes";
import webhooksRouter from "./routes/webhooks";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";

const app: Express = express();

// ─── gzip sıkıştırma — yanıt boyutunu %70-80 azaltır ─────────────────────────
app.use(compression());

// ─── Staging: arama motorlarına kapalı + hangi ortam olduğu header'da ────────
app.use((_req, res, next) => {
  res.setHeader("X-App-Env", appEnv());
  if (isStaging()) res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

app.use(metricsMiddleware);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.set("trust proxy", 1);

// ─── Helmet — güvenlik HTTP başlıkları ────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://www.googletagmanager.com",
          "https://www.google-analytics.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        connectSrc: [
          "'self'",
          "https://app.sphereenglish.com",
          "https://www.google-analytics.com",
          "https://region1.google-analytics.com",
        ],
        mediaSrc: ["'self'", "blob:"],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    frameguard: { action: "sameorigin" },
    permittedCrossDomainPolicies: false,
  })
);

// ─── Permissions-Policy (helmet'te yerleşik değil) ────────────────────────────
app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)"
  );
  next();
});

// ─── HTTPS Yönlendirme (Production) ───────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    const proto = req.headers["x-forwarded-proto"];
    if (proto && proto !== "https") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// ─── CORS — yalnızca izin verilen origin'ler ──────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://app.sphereenglish.com",
  "https://www.sphereenglish.com",
  "https://sphereenglish.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Replit geliştirme ortamı
  if (origin.endsWith(".riker.replit.dev") || origin.endsWith(".replit.dev")) return true;
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(cookieParser());
app.use(express.json({
  // Webhook imza doğrulaması için raw body capture (Resend/SendGrid/Stripe için gerekli)
  verify: (req: any, _res, buf) => {
    if (buf && buf.length) req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ─── Rate Limiting ────────────────────────────────────────────────────────────

// Giriş endpoint'i: 15 dakikada en fazla 10 deneme
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin." },
  skipSuccessfulRequests: true,
});

// Kayıt endpoint'i: 1 saatte en fazla 5 kayıt
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla kayıt denemesi. Lütfen 1 saat sonra tekrar deneyin." },
});

// Genel API: Dakikada en fazla 200 istek
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "İstek limiti aşıldı. Lütfen bir dakika bekleyin." },
  skip: (req) => req.path.startsWith("/uploads"),
});

/**
 * Yardımcı: authenticated kullanıcıda userId'ye göre, değilse IP'ye göre
 * key üretir. Böylece bir kullanıcının birden fazla IP'den (örn. mobile data
 * + wifi) aynı limiti paylaşmasını sağlar.
 */
function userOrIp(req: any): string {
  return req.userId ? `u:${req.userId}` : `ip:${req.ip || req.connection?.remoteAddress || "unknown"}`;
}

// Forgot password: 15 dakikada en fazla 3 deneme (email flooding önleme)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla şifre sıfırlama talebi. Lütfen 15 dakika sonra tekrar deneyin." },
});

// AI endpoint'leri: dakikada en fazla 20 istek (OpenAI maliyet kontrolü)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIp,
  message: { error: "AI isteği limiti aşıldı. Lütfen bir dakika bekleyin." },
});

// Chatbot (anon public): dakikada en fazla 30 istek per IP
const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok hızlı yazıyorsunuz. Lütfen biraz yavaşlayın." },
});

// E-kitap "Haberdar ol" formu (anon public): saatte en fazla 5 kayıt per IP
const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla kayıt denemesi. Lütfen daha sonra tekrar deneyin." },
});

// Payment: 10 dakikada en fazla 10 işlem (ödeme deneme spamı önleme)
const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIp,
  message: { error: "Çok fazla ödeme denemesi. Lütfen 10 dakika sonra tekrar deneyin." },
  // Provider webhook'u korunmasın — provider sunucusundan geliyor
  skip: (req) => req.path.includes("/webhook"),
});

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/auth/forgot-password", forgotPasswordLimiter);

// AI endpoint'leri — OpenAI maliyet kontrolü
app.use("/api/pronunciation", aiLimiter);
app.use("/api/writing", aiLimiter);
app.use("/api/grammar", aiLimiter);
app.use("/api/interview", aiLimiter);
app.use("/api/presentation", aiLimiter);
app.use("/api/ai-quiz", aiLimiter);
app.use("/api/tutor", aiLimiter);
app.use("/api/scenes", aiLimiter);
app.use("/api/vocab-game/game/guess", aiLimiter);
app.use("/api/vocab-game/game/hint", aiLimiter);

// Chatbot (anon)
app.use("/api/chat", chatbotLimiter);

// Payment — checkout flow, provider webhook'u skip ediliyor (yukarıdaki config)
app.use("/api/ebook-marketing/waitlist", waitlistLimiter);
app.use("/api-server/api/ebook-marketing/waitlist", waitlistLimiter);

app.use("/api/checkout", paymentLimiter);
app.use("/api/internal/payment", paymentLimiter);
app.use("/api/internal/subscription", paymentLimiter);

app.use("/api", apiLimiter);

// Serve uploaded materials files
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

// Serve vocab game static HTML (works in both dev and production)
const vocabGameDir = path.join(process.cwd(), "artifacts/api-server/public/vocab-game");
if (fs.existsSync(vocabGameDir)) {
  app.use("/vocab-game", express.static(vocabGameDir));
  logger.info({ vocabGameDir }, "Serving vocab game static files");
}

// Serve email icons (public, mail'lerde inline PNG olarak kullanılıyor)
const emailIconsDir = path.join(process.cwd(), "artifacts/api-server/public/email-icons");
if (fs.existsSync(emailIconsDir)) {
  app.use("/email-icons", express.static(emailIconsDir, {
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  }));
  logger.info({ emailIconsDir }, "Serving email icons");
}

// Resend webhook — /api prefix'i yok, ham JSON gerekiyor
app.use(webhooksRouter);

app.use("/api", router);
app.use("/api-server/api", router);

// Serve built frontend static files in production
const staticDir = process.env["STATIC_DIR"] ?? path.join(process.cwd(), "public");
if (fs.existsSync(staticDir)) {
  // Hashed bundle dosyaları (main.abc123.js) → 1 yıl cache
  // index.html → cache yok (her deploy'da güncel sürüm alınsın)
  app.use(express.static(staticDir, {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      // index.html + PWA dosyaları (sw.js, manifest, offline) her zaman taze olsun
      if (/(?:index\.html|sw\.js|manifest\.webmanifest|offline\.html)$/.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        if (filePath.endsWith("sw.js")) res.setHeader("Service-Worker-Allowed", "/");
      } else {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));
  app.get("/{*splat}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(staticDir, "index.html"));
  });
  logger.info({ staticDir }, "Serving static frontend files");
}

// ─── Hata yönetimi — diğer tüm middleware'lerden SONRA gelmeli ───────────────
// /api/* eşleşmeyenler için 404
app.use("/api", notFoundHandler);
// Her türlü async/sync hata bu noktada yakalanır
app.use(errorHandler);

export default app;
