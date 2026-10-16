// vitest setupFiles — her test worker'ında, test dosyası import edilmeden ÖNCE koşar.
// Böylece @workspace/db (DATABASE_URL) ve middlewares/auth (JWT_SECRET) doğru env ile yüklenir.
import { applyTestEnv } from "./test-env.js";

applyTestEnv();
