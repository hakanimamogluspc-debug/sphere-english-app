/**
 * /api/openapi.yaml ve /api/openapi.json
 *
 * OpenAPI spec'i public olarak sun. AI agent'lar ve /.well-known/api-catalog
 * tarafından referans verilir.
 */

import { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";

const router = Router();

// Workspace root'taki lib/api-spec/openapi.yaml dosyasını oku
function readSpec(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "lib/api-spec/openapi.yaml"),
    path.resolve(process.cwd(), "../../lib/api-spec/openapi.yaml"),
    path.resolve(process.cwd(), "artifacts/api-server/openapi.yaml"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
    } catch {
      // ignore
    }
  }
  return null;
}

router.get("/openapi.yaml", (_req: Request, res: Response) => {
  const spec = readSpec();
  if (!spec) {
    return res
      .status(404)
      .json({ error: "OpenAPI spec dosyası bulunamadı." });
  }
  res.setHeader("Content-Type", "application/yaml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.send(spec);
});

router.get("/openapi.json", (_req: Request, res: Response) => {
  // Basit YAML → JSON dönüştürme; gerçek yaml parser gerek
  const spec = readSpec();
  if (!spec) {
    return res
      .status(404)
      .json({ error: "OpenAPI spec dosyası bulunamadı." });
  }
  // Sadece YAML olarak sun, JSON için ayrı endpoint kullanılması bekleniyor
  res.setHeader("Content-Type", "application/yaml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.send(spec);
});

export default router;
