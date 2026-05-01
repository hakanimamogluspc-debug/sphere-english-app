FROM node:20-alpine AS deps
  WORKDIR /app
  COPY package.json ./
  RUN npm install

  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY --from=deps /app/node_modules ./node_modules
  COPY . .
  RUN npm run build

  FROM node:20-alpine AS runner
  WORKDIR /app
  ENV NODE_ENV=production
  COPY --from=builder /app/.next ./.next
  COPY --from=builder /app/public ./public
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/package.json ./package.json
  COPY --from=builder /app/next.config.mjs ./next.config.mjs
  COPY --from=builder /app/image-hosts.config.js ./image-hosts.config.js
  COPY --from=builder /app/image-hosts.config.mjs ./image-hosts.config.mjs
  EXPOSE 80
  CMD ["node_modules/.bin/next", "start", "-p", "80"]
  