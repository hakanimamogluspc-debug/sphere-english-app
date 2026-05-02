import path from 'path';
import { fileURLToPath } from 'url';
import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import sharp from 'sharp';

import { Users } from './src/payload/collections/Users';
import { Media } from './src/payload/collections/Media';
import { Solutions } from './src/payload/collections/Solutions';
import { BlogPosts } from './src/payload/collections/BlogPosts';
import { HomePage } from './src/payload/globals/HomePage';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ' — Sphere English CMS',
    },
  },
  collections: [Users, Media, Solutions, BlogPosts],
  globals: [HomePage],
  editor: lexicalEditor({}),
  secret: (() => {
    const s = process.env.PAYLOAD_SECRET;
    if (s && s.length >= 16) return s;
    // During `next build` the API route is statically analyzed and Payload
    // config is loaded — but env vars from the runtime are not available.
    // Detect the build phase and return a placeholder; real runtime check
    // happens via NEXT_PHASE=phase-production-server below.
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
    if (isBuildPhase) {
      return 'build-time-placeholder-secret-not-used-at-runtime-xxxxxxxxxx';
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PAYLOAD_SECRET env var is required in production (min 16 chars).');
    }
    return 'dev-only-secret-do-not-use-in-production-1234567890';
  })(),
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload/payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL,
    },
    schemaName: 'payload',
    // push: true is convenient in dev. In prod, opt-in via PAYLOAD_DB_PUSH=true
    // (initial deploy needs this once to create the schema).
    push: process.env.NODE_ENV !== 'production' || process.env.PAYLOAD_DB_PUSH === 'true',
  }),
  sharp,
  upload: {
    limits: { fileSize: 10_000_000 }, // 10MB
  },
  cors: [
    'https://www.sphereenglish.com',
    'https://sphereenglish.com',
    'http://localhost:3000',
  ],
  csrf: [
    'https://www.sphereenglish.com',
    'https://sphereenglish.com',
    'http://localhost:3000',
  ],
});
