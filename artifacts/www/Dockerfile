FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps --include=optional
# Patch payload's loadEnv.js: it uses `import x from '@next/env'` (default import)
# but @next/env only has named exports, causing a crash on load.
# Change default import → namespace import so destructuring works.
RUN if [ -f /app/node_modules/payload/dist/bin/loadEnv.js ]; then \
      sed -i "s|import nextEnvImport from '@next/env';|import * as nextEnvImport from '@next/env';|" \
        /app/node_modules/payload/dist/bin/loadEnv.js && \
      echo '[patch] payload/dist/bin/loadEnv.js patched successfully' && \
      head -3 /app/node_modules/payload/dist/bin/loadEnv.js; \
    else \
      echo '[patch] loadEnv.js not found — skipping'; \
    fi

FROM node:20-bookworm-slim AS builder
WORKDIR /app
# Build-time env vars passed by EasyPanel via --build-arg.
# Declared as ARG so they are visible to `next build`.
ARG BREVO_API_KEY
ARG NOTION_API_KEY
ARG NOTION_DATABASE_ID
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG META_CONVERSIONS_API_TOKEN
ARG PAYLOAD_SECRET
ARG PAYLOAD_DB_PUSH
ARG SEED_TOKEN
ARG DATABASE_URL
ARG DATABASE_URI
ARG GIT_SHA
ENV BREVO_API_KEY=$BREVO_API_KEY \
    NOTION_API_KEY=$NOTION_API_KEY \
    NOTION_DATABASE_ID=$NOTION_DATABASE_ID \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID \
    META_CONVERSIONS_API_TOKEN=$META_CONVERSIONS_API_TOKEN \
    PAYLOAD_SECRET=$PAYLOAD_SECRET \
    PAYLOAD_DB_PUSH=$PAYLOAD_DB_PUSH \
    SEED_TOKEN=$SEED_TOKEN \
    DATABASE_URL=$DATABASE_URL \
    DATABASE_URI=$DATABASE_URI \
    GIT_SHA=$GIT_SHA \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/payload.config.ts ./payload.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/image-hosts.config.js ./image-hosts.config.js
COPY --from=builder /app/image-hosts.config.mjs ./image-hosts.config.mjs
EXPOSE 80
# On startup: if PAYLOAD_DB_PUSH=true, run a one-shot schema push (NODE_ENV=development
# is required to bypass the @payloadcms/db-postgres prod guard that disables push).
# Failure is non-fatal — server still starts so we can debug from logs.
CMD ["sh", "-c", "if [ \"$PAYLOAD_DB_PUSH\" = \"true\" ]; then echo '>>> Running one-shot schema push'; NODE_ENV=development node_modules/.bin/tsx scripts/push-schema.ts || echo '>>> Schema push failed (continuing to start server)'; else echo '>>> PAYLOAD_DB_PUSH not set — skipping schema push'; fi && exec node_modules/.bin/next start -p 80"]
