FROM node:20-alpine AS deps
WORKDIR /app
# Native deps for sharp (used by Payload Media uploads) + libc compat
RUN apk add --no-cache libc6-compat python3 make g++ vips-dev
COPY package.json ./
RUN npm install --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat vips-dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat vips
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/payload.config.ts ./payload.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/image-hosts.config.js ./image-hosts.config.js
COPY --from=builder /app/image-hosts.config.mjs ./image-hosts.config.mjs
EXPOSE 80
CMD ["node_modules/.bin/next", "start", "-p", "80"]
