import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

/**
 * Express 5'te async route handler'lar reject olunca otomatik error middleware'a gider.
 * Bu middleware tüm yakalanmamış hataları toplar, log'lar ve kullanıcıya temiz bir
 * JSON döner — production'da stack trace sızdırmaz.
 *
 * Mutlaka `app.use("/api", router)`'dan SONRA mount edilmeli.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  // Bilinen HTTP hata türleri
  const status =
    typeof err?.status === "number"
      ? err.status
      : typeof err?.statusCode === "number"
        ? err.statusCode
        : 500;

  // CORS hataları — origin reddedildi
  if (typeof err?.message === "string" && err.message.startsWith("CORS:")) {
    logger.warn({ origin: req.headers.origin, url: req.originalUrl }, "CORS reddedildi");
    res.status(403).json({ error: "CORS: origin not allowed" });
    return;
  }

  // Multer hataları — dosya yükleme limitleri/format
  if (err?.name === "MulterError" || err?.type === "MulterError") {
    const code = String(err?.code ?? "");
    let msg = "Dosya yüklenemedi";
    if (code === "LIMIT_FILE_SIZE") {
      msg = "Dosya çok büyük (maksimum 100 MB). Lütfen daha küçük bir dosya yükle.";
    } else if (code === "LIMIT_UNEXPECTED_FILE") {
      msg = "Beklenmeyen dosya alanı";
    } else if (code === "LIMIT_FILE_COUNT") {
      msg = "Çok fazla dosya yüklendi";
    } else if (err?.message) {
      msg = `Yükleme hatası: ${err.message}`;
    }
    logger.warn({ code, url: req.originalUrl }, "Multer hatası");
    res.status(413).json({ error: msg });
    return;
  }

  // 4xx — kullanıcı hatası, info düzeyinde
  if (status >= 400 && status < 500) {
    logger.info({ err: err.message, url: req.originalUrl, status }, "Client error");
    res.status(status).json({
      error: typeof err?.message === "string" ? err.message : "İstek işlenemedi",
    });
    return;
  }

  // 5xx — sunucu hatası, full log
  logger.error(
    {
      err,
      url: req.originalUrl,
      method: req.method,
      userId: (req as any).userId,
    },
    "Unhandled server error"
  );

  // Production'da stack trace dışarı verme ama error.message'ı her zaman göster
  // (admin için teşhis kolaylaştırıcı, hassas bilgi içermiyorsa).
  const expose = process.env.NODE_ENV !== "production";
  const errMsg = typeof err?.message === "string" ? err.message : "";
  // Hassas bilgi (DB connection string, secret, vs.) içeriyorsa filtrele
  const safeMsg = errMsg.match(/password|secret|token|api[_-]?key|connection/i)
    ? "Sunucu hatası, lütfen daha sonra tekrar deneyin"
    : errMsg
      ? `Sunucu hatası: ${errMsg}`
      : "Sunucu hatası, lütfen daha sonra tekrar deneyin";

  res.status(status).json({
    error: safeMsg,
    ...(expose ? { stack: err?.stack } : {}),
  });
}

/** 404 — hiçbir route eşleşmedi */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "Bulunamadı", path: req.originalUrl });
}
