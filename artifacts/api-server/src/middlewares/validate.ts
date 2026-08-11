import type { Request, Response, NextFunction, RequestHandler } from "express";
import { z, ZodError, type ZodTypeAny } from "zod";

/**
 * Express middleware factory that validates request body against a Zod schema.
 * Eğer geçerliyse `req.body` parse edilmiş, type-safe veri ile değiştirilir.
 * Eğer geçersizse 400 ile alan başına hata listesi döner.
 *
 * Kullanım:
 *   const loginSchema = z.object({
 *     email: z.string().email(),
 *     password: z.string().min(1),
 *   });
 *   router.post("/auth/login", validateBody(loginSchema), async (req, res) => {
 *     const { email, password } = req.body; // tip: { email: string; password: string }
 *   });
 */
export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const flat = (result.error as ZodError).flatten();
      res.status(400).json({
        error: "Geçersiz istek gövdesi",
        fields: flat.fieldErrors,
        formErrors: flat.formErrors,
      });
      return;
    }
    // İçeriği parse edilmiş (coerce/transform uygulanmış) versiyonla değiştir.
    req.body = result.data;
    next();
  };
}

/** Query string için aynı yardımcı (`?foo=bar`). */
export function validateQuery<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const flat = (result.error as ZodError).flatten();
      res.status(400).json({
        error: "Geçersiz query parametreleri",
        fields: flat.fieldErrors,
        formErrors: flat.formErrors,
      });
      return;
    }
    // req.query Express tarafından readonly tutulduğu için _validated alanına yaz.
    (req as any)._validatedQuery = result.data;
    next();
  };
}

/** URL parametreleri için (`/users/:id`). */
export function validateParams<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const flat = (result.error as ZodError).flatten();
      res.status(400).json({
        error: "Geçersiz URL parametreleri",
        fields: flat.fieldErrors,
        formErrors: flat.formErrors,
      });
      return;
    }
    next();
  };
}

// Sık kullanılan parça şemalar — diğer route'larda paylaşılır
export const schemas = {
  email: z.string().trim().toLowerCase().email("Geçersiz e-posta"),
  password: z
    .string()
    .min(8, "Parola en az 8 karakter olmalı")
    .max(128, "Parola en fazla 128 karakter olabilir"),
  shortString: z.string().trim().min(1).max(200),
  cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
};
