import express, { type Express } from "express";
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
app.use(express.json());
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

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", registerLimiter);
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
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
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
