import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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

// ─── HTTPS Yönlendirme + HSTS (Production) ────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    const proto = req.headers["x-forwarded-proto"];
    if (proto && proto !== "https") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    // HSTS: tarayıcıya 1 yıl boyunca yalnızca HTTPS kullanmasını söyle
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests and configured domains
    if (!origin || origin.includes("sphereenglish.com") || origin.includes("localhost")) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
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

app.use("/api", router);

// Serve built frontend static files in production
const staticDir = process.env["STATIC_DIR"] ?? path.join(process.cwd(), "public");
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
  logger.info({ staticDir }, "Serving static frontend files");
}

export default app;
