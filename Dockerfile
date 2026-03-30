FROM node:20-alpine AS base
RUN apk add --no-cache ffmpeg
RUN npm install -g pnpm@9

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY artifacts/api-server/package.json ./artifacts/api-server/

RUN pnpm install --frozen-lockfile

COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm --filter @workspace/api-server build

ENV NODE_ENV=production
ENV PORT=8080

ARG OPENAI_API_KEY
ENV OPENAI_API_KEY=${OPENAI_API_KEY}

EXPOSE 8080

CMD ["/bin/sh", "-c", "/usr/local/bin/pnpm --filter @workspace/db push --force && node --enable-source-maps artifacts/api-server/dist/index.mjs"]
