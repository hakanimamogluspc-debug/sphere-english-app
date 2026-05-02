/**
 * One-shot Payload schema push for production.
 *
 * Why this exists:
 *   `@payloadcms/db-postgres` only auto-pushes the schema (drizzle push) when
 *   `process.env.NODE_ENV !== 'production'`. Setting `push: true` in the config
 *   is ignored at runtime in production. To create initial Payload tables in
 *   the production database, run this script once with NODE_ENV=development
 *   override (the Dockerfile CMD does this when PAYLOAD_DB_PUSH=true).
 *
 * Usage (handled automatically by Dockerfile CMD on startup):
 *   NODE_ENV=development tsx scripts/push-schema.ts
 *
 * After tables are created on first deploy, remove PAYLOAD_DB_PUSH from env
 * to skip this step on subsequent deploys.
 */
import { getPayload } from 'payload';
import config from '../payload.config';

(async () => {
  console.log('[push-schema] NODE_ENV =', process.env.NODE_ENV);
  console.log('[push-schema] DATABASE_URL set:', !!process.env.DATABASE_URL);
  console.log('[push-schema] Initializing Payload — this triggers drizzle schema push...');
  try {
    await getPayload({ config });
    console.log('[push-schema] ✅ Payload initialized; schema should now be present in DB.');
    process.exit(0);
  } catch (err) {
    console.error('[push-schema] ❌ FAILED:', err);
    process.exit(1);
  }
})();
