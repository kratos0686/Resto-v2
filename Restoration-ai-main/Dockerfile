# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only copy what is needed to run the server
COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
