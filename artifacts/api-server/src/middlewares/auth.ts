import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "sphere-english-secret-key-2024";

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  userAccountType?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if ((req as any).cookies?.sphere_token) {
    token = (req as any).cookies.sphere_token;
  }

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; role: string; accountType?: string };
    req.userId = payload.userId;
    req.userRole = payload.role;
    req.userAccountType = payload.accountType;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function optionalAuthMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if ((req as any).cookies?.sphere_token) {
    token = (req as any).cookies.sphere_token;
  }

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number; role: string; accountType?: string };
      req.userId = payload.userId;
      req.userRole = payload.role;
      req.userAccountType = payload.accountType;
    } catch {
      /* ignore invalid token — proceed unauthenticated */
    }
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function generateToken(userId: number, role: string, accountType?: string | null): string {
  return jwt.sign({ userId, role, ...(accountType ? { accountType } : {}) }, JWT_SECRET, { expiresIn: "7d" });
}
