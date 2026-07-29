FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
# Install Chromium for automated report rendering (Puppeteer)
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PORT=5000
ENV NODE_ENV=production

WORKDIR /app
COPY package*.json ./
RUN npm ci --production && npm i tsx drizzle-kit dotenv zod date-fns date-fns-tz papaparse uuid winston cors express helmet morgan pg openai
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

EXPOSE 5000

# Auto-run PostgreSQL schema migration and seed data on startup before launching API server
CMD ["sh", "-c", "npx tsx src/db/migrate.ts && npx tsx src/db/seed.ts && node dist/index.js"]
