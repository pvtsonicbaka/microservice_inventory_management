FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
EXPOSE 3002
CMD ["node", "dist/index.js"]
