import { Router, type IRouter } from "express";
import { appEnv } from "../lib/app-env.js";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json({ ...data, env: appEnv(), gitSha: process.env.GIT_SHA ?? null });
});

export default router;
