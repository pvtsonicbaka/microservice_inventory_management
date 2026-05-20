# 🏭 Microservices Inventory Management System

> **Event-Driven · Fault-Tolerant · Scalable Retail Backend**

A production-grade microservices backend for e-commerce inventory operations — featuring service decomposition, event-driven communication via Kafka, saga-based distributed transactions, Elasticsearch-powered search, and a React admin dashboard.

**Project Code:** `lv1-2026-03-02`  
**Version:** 2.0  
**Author:** LogicVeda Web Development Domain  
**Date:** March 2026

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Event-Driven Architecture](#event-driven-architecture)
- [Resilience Patterns](#resilience-patterns)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Security](#security)
- [Deployment](#deployment)

---

## Architecture Overview

```
                        ┌─────────────────────────────────┐
                        │         CLIENT / BROWSER         │
                        └──────────────┬──────────────────┘
                                       │ HTTPS
                        ┌──────────────▼──────────────────┐
                        │           API GATEWAY            │
                        │  JWT validation · Rate limiting  │
                        │  Request routing · CORS          │
                        └──┬────────┬────────┬──────────┬─┘
                           │        │        │          │
              ┌────────────▼┐ ┌─────▼──────┐ ┌▼───────┐ ┌▼────────────┐
              │ AUTH SERVICE│ │ INVENTORY  │ │ ORDERS │ │  REPORTING  │
              │             │ │  SERVICE   │ │SERVICE │ │   SERVICE   │
              └──────┬──────┘ └──────┬─────┘ └───┬────┘ └──────┬──────┘
                     │               │            │             │
              ┌──────▼──────┐ ┌──────▼─────┐ ┌───▼────┐ ┌──────▼──────┐
              │  auth_db    │ │inventory_db│ │orders_db│ │Elasticsearch│
              │ (Postgres)  │ │ (Postgres) │ │(Postgres│ │  + Kafka    │
              └─────────────┘ └────────────┘ └─────────┘ └─────────────┘

                        ┌─────────────────────────────────┐
                        │         EVENT BUS (Kafka)        │
                        │  order.placed · stock.updated    │
                        │  order.confirmed · order.cancel  │
                        │  stock.low-alert · product.*     │
                        └─────────────────────────────────┘
```

### Saga Pattern — Order Flow

```
User → POST /orders
  └─► Orders Service creates order (PENDING)
        └─► Publishes: order.placed
              └─► Inventory Service checks stock
                    ├── OK  → reserves stock → publishes: stock.updated
                    │           └─► Orders Service → CONFIRMED
                    │                 └─► Inventory deducts stock (order.confirmed)
                    └── FAIL → publishes: order.cancelled (insufficient_stock)
                                  └─► Orders Service → FAILED
```

---

## Services

| Service | Port (Docker) | Port (Local) | Description |
|---------|--------------|--------------|-------------|
| api-gateway | 4000 | 3000 | Entry point — JWT validation, rate limiting, routing |
| auth-service | 4001 | 3001 | Users, roles, JWT issuance, Redis blacklist |
| inventory-service | 4002 | 3002 | Products, stock, warehouses, low-stock alerts |
| orders-service | 4003 | 3003 | Orders, saga orchestration, circuit breaker |
| reporting-service | 4004 | 3004 | Elasticsearch search + analytics dashboard |
| admin-dashboard | 5173 | 5173 | React + Tailwind admin UI |

### Infrastructure

| Service | Port |
|---------|------|
| PostgreSQL (×3) | 5432 (internal) |
| Redis | 6380 |
| Kafka | 9093 |
| Elasticsearch | 9200 |

---

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Runtime | Node.js | 22 |
| Language | TypeScript | 5.5+ |
| Framework | Express | 4.19 |
| ORM | Prisma | 5.14 |
| Database | PostgreSQL | 16 |
| Message Broker | Kafka (Confluent) | 7.6 |
| Cache / Blacklist | Redis | 7 |
| Search | Elasticsearch | 8.14 |
| Auth | jsonwebtoken + bcryptjs | 9 / 2.4 |
| Validation | Zod | 3.23 |
| HTTP Client | Axios | 1.7 |
| Frontend | React + Vite + Tailwind | 18 / 5 / 3 |
| Build System | Turborepo | 2 |
| Containers | Docker + Docker Compose | — |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 22+
- npm 10+

### 1. Clone and install

```bash
git clone <repo-url>
cd month2
npm install
```

### 2. Start all services

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

This starts all databases, Kafka, Elasticsearch, Redis, all microservices, and the admin dashboard.

### 3. Run database migrations

Wait ~30 seconds for services to be healthy, then:

```bash
# In separate terminals or run sequentially
docker compose -f infra/docker/docker-compose.yml exec auth-service npx prisma migrate deploy
docker compose -f infra/docker/docker-compose.yml exec inventory-service npx prisma migrate deploy
docker compose -f infra/docker/docker-compose.yml exec orders-service npx prisma migrate deploy
```

### 4. Seed demo data

```bash
# 1. Register an admin user
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123","name":"Admin"}'

# 2. Promote to admin (requires existing admin — use the DB directly for first admin)
# Or use the seed script:
bash scripts/seed.sh
```

### 5. Access the admin dashboard

Open [http://localhost:5173](http://localhost:5173)

---

## Environment Variables

### api-gateway

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `JWT_ACCESS_SECRET` | — | **Required.** JWT signing secret |
| `AUTH_SERVICE_URL` | http://auth-service:3001 | Auth service URL |
| `INVENTORY_SERVICE_URL` | http://inventory-service:3002 | Inventory service URL |
| `ORDERS_SERVICE_URL` | http://orders-service:3003 | Orders service URL |
| `REPORTING_SERVICE_URL` | http://reporting-service:3004 | Reporting service URL |
| `CORS_ORIGINS` | http://localhost:5173 | Comma-separated allowed origins |

### auth-service

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | — | **Required.** Access token secret |
| `JWT_REFRESH_SECRET` | — | **Required.** Refresh token secret |
| `REDIS_URL` | redis://localhost:6379 | Redis for JWT blacklist |

### inventory-service

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3002 | Server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `AUTH_SERVICE_URL` | http://auth-service:3001 | For token validation |
| `KAFKA_BROKER` | localhost:9092 | Kafka broker address |

### orders-service

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3003 | Server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `AUTH_SERVICE_URL` | http://auth-service:3001 | For token validation |
| `INVENTORY_SERVICE_URL` | http://inventory-service:3002 | For price lookups |
| `KAFKA_BROKER` | localhost:9092 | Kafka broker address |

### reporting-service

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3004 | Server port |
| `ELASTICSEARCH_URL` | http://elasticsearch:9200 | Elasticsearch URL |
| `KAFKA_BROKER` | kafka:29092 | Kafka broker address |
| `AUTH_SERVICE_URL` | http://auth-service:3001 | For token validation |

---

## API Reference

All requests go through the API Gateway at `http://localhost:4000`.

### Authentication

```
POST /auth/register    — Register new user (returns viewer role)
POST /auth/login       — Login (returns access + refresh tokens)
POST /auth/refresh     — Refresh access token
POST /auth/logout      — Logout (blacklists access token, deletes refresh token)
GET  /auth/validate    — Validate token (used internally by services)
GET  /auth/users       — List users (admin only)
PATCH /auth/users/:id/role — Change user role (admin only)
```

### Products

```
GET    /products              — List products (paginated, filterable)
GET    /products/:id          — Get product by ID
POST   /products              — Create product (admin/manager)
PUT    /products/:id          — Update product (admin/manager)
DELETE /products/:id          — Delete product (admin)
POST   /products/seed         — Seed demo products (admin)
```

### Stock

```
GET   /products/:id/stock     — Get stock levels per warehouse
PATCH /products/:id/stock     — Update stock (increment/decrement/set)
GET   /stock/alerts           — Get low-stock alerts (admin/manager)
```

### Warehouses

```
GET    /warehouses            — List warehouses
POST   /warehouses            — Create warehouse (admin)
DELETE /warehouses/:id        — Delete warehouse (admin)
```

### Orders

```
GET  /orders                  — List orders (own orders; admin sees all)
POST /orders                  — Place order (triggers saga)
GET  /orders/:id              — Get order details
GET  /orders/:id/status       — Get order status + saga steps
POST /orders/:id/cancel       — Cancel order
```

### Search & Reporting

```
GET  /search/products         — Elasticsearch product search (faceted)
GET  /reports/dashboard       — Analytics dashboard (admin/manager)
GET  /reports/stock-alerts    — Paginated stock alerts (admin/manager)
POST /reports/products/reindex — Trigger product reindex (admin)
```

### Query Parameters — Product Search

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Full-text search (fuzzy) |
| `category` | string | Filter by category |
| `minPrice` | number | Minimum price filter |
| `maxPrice` | number | Maximum price filter |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (max: 100, default: 20) |

---

## Event-Driven Architecture

See [`shared/events/kafka-events.md`](shared/events/kafka-events.md) for full event schemas.

### Topics

| Topic | Publisher | Consumers |
|-------|-----------|-----------|
| `order.placed` | orders-service | inventory-service, reporting-service |
| `stock.updated` | inventory-service | orders-service |
| `order.confirmed` | orders-service | inventory-service, reporting-service |
| `order.cancelled` | inventory-service / orders-service | orders-service, inventory-service, reporting-service |
| `stock.low-alert` | inventory-service | reporting-service |
| `product.created` | inventory-service | reporting-service |
| `product.updated` | inventory-service | reporting-service |
| `product.deleted` | inventory-service | reporting-service |

### Idempotency & At-Least-Once Delivery

- Each event carries a unique `eventId` (UUID v4)
- Kafka consumer group IDs match service names for correct offset tracking
- `order.cancelled` with `reason: "insufficient_stock"` is ignored by inventory-service to prevent double-releasing reservations
- Low-stock alerts are deduplicated: max one alert per product per hour (DB index + query guard)

---

## Resilience Patterns

### Circuit Breaker (orders-service → inventory-service)

The orders service wraps all calls to inventory-service in a circuit breaker:

- **Threshold:** 5 consecutive failures → circuit opens
- **Recovery:** 30 seconds → half-open probe
- **Fallback:** Returns `503 Service Unavailable` immediately when open

### Graceful Degradation (reporting-service)

- If Elasticsearch is down, search returns `{ data: [], warning: "Search index unavailable" }`
- Dashboard returns zeroed metrics with a `warning` field
- Service starts successfully even if ES or Kafka are unavailable

### Kafka Consumer Crash Recovery

- All services use `consumer.on("consumer.crash", ...)` → `process.exit(1)`
- Docker/Kubernetes restarts the container automatically
- Kafka retains messages (at-least-once delivery)

### Rate Limiting

- Global: 100 requests/minute per IP
- Auth endpoints: 20 requests/15 minutes per IP (brute-force protection)

### JWT Blacklist

- On logout, the access token's JTI is stored in Redis with TTL = remaining token lifetime
- `GET /auth/validate` checks the blacklist before returning user info
- Degrades gracefully if Redis is unavailable (blacklist disabled, tokens expire naturally)

---

## Testing

Tests are integration tests using Node's built-in `node:test` runner. They require running services.

### Run all tests

```bash
# From workspace root
npm run test
```

### Run individual service tests

```bash
# Auth service
cd services/auth-service
AUTH_URL=http://localhost:4001 npm run test

# Inventory service (requires admin token)
cd services/inventory-service
GATEWAY_URL=http://localhost:4000 AUTH_URL=http://localhost:4001 ADMIN_TOKEN=<token> npm run test

# Orders service (requires seeded product)
cd services/orders-service
GATEWAY_URL=http://localhost:4000 AUTH_URL=http://localhost:4001 TEST_PRODUCT_ID=<uuid> ADMIN_TOKEN=<token> npm run test

# Reporting service
cd services/reporting-service
REPORTING_URL=http://localhost:4004 AUTH_URL=http://localhost:4001 GATEWAY_URL=http://localhost:4000 ADMIN_TOKEN=<token> npm run test
```

### End-to-end saga test

```bash
bash docs/e2e-saga-test.sh
```

### Chaos test

```bash
bash docs/chaos-test.sh
```

### Test Coverage

| Service | Test File | Coverage Areas |
|---------|-----------|----------------|
| auth-service | `auth.test.ts` | Register, login, validate, refresh, logout, role management |
| inventory-service | `inventory.test.ts` | Products CRUD, stock operations, warehouses, alerts |
| orders-service | `orders.test.ts` | Order placement, saga flow, cancellation, RBAC |
| reporting-service | `reporting.test.ts` | Search, dashboard, stock alerts, pagination, graceful degradation |

---

## Project Structure

```
month2/
├── services/
│   ├── api-gateway/          # Entry point: routing, JWT, rate limiting
│   │   └── src/
│   │       ├── index.ts      # Express app + proxy logic
│   │       └── middleware/   # auth.ts, correlation.ts
│   ├── auth-service/         # Users, JWT, Redis blacklist
│   │   └── src/
│   │       ├── routes/auth.ts
│   │       └── lib/          # jwt.ts, redis.ts, prisma.ts
│   ├── inventory-service/    # Products, stock, warehouses
│   │   └── src/
│   │       ├── routes/       # products.ts, stock.ts, warehouses.ts
│   │       └── lib/kafka.ts  # Saga consumer (order.placed handler)
│   ├── orders-service/       # Orders + saga orchestration
│   │   └── src/
│   │       ├── routes/orders.ts
│   │       └── lib/          # kafka.ts, circuit-breaker.ts
│   ├── reporting-service/    # Elasticsearch search + analytics
│   │   └── src/
│   │       ├── routes/       # search.ts, reports.ts
│   │       └── lib/          # elastic.ts, kafka.ts
│   └── admin-dashboard/      # React + Vite + Tailwind UI
├── shared/
│   └── events/kafka-events.md  # Kafka event schema documentation
├── docs/
│   ├── architecture/system-architecture.md
│   ├── openapi/              # Per-service OpenAPI specs
│   ├── e2e-saga-test.sh
│   ├── chaos-test.sh
│   └── smoke-test.sh
├── infra/
│   ├── docker/docker-compose.yml
│   └── k8s/                  # Kubernetes manifests (in progress)
├── scripts/seed.sh
├── package.json              # Turborepo workspace root
└── turbo.json
```

---

## Security

| Concern | Mitigation |
|---------|-----------|
| JWT forgery | HS256 with strong secrets; validated on every request |
| Token replay after logout | Redis blacklist keyed by JTI with TTL |
| Brute force login | Auth-specific rate limiter: 20 req / 15 min |
| SQL injection | Prisma parameterized queries |
| Oversized payloads | `express.json({ limit: "10kb" })` on all routes |
| CORS | Allowlist-based origin validation |
| Role escalation | `requireRole()` middleware on all sensitive routes |
| Secrets in repo | `.env.example` files only; actual secrets via env vars |

> ⚠️ **Production note:** The `docker-compose.yml` contains placeholder secrets (`super_secret_*`). Replace these with strong random values before any real deployment. Use a secrets manager (AWS Secrets Manager, Vault, etc.) in production.

---

## Deployment

### Docker Compose (local / staging)

```bash
docker compose -f infra/docker/docker-compose.yml up --build -d
```

### Kubernetes (in progress)

Manifests are in `infra/k8s/`. Each service has a `Deployment` + `Service`. HPA configs are planned.

```bash
kubectl apply -f infra/k8s/
```

### Health Checks

All services expose `GET /health`:

```json
{ "status": "ok", "service": "auth-service" }
```

The API Gateway aggregates all service health checks:

```bash
curl http://localhost:4000/health
# { "status": "ok", "services": { "auth": "up", "inventory": "up", "orders": "up", "reporting": "up" } }
```

---

## Development

### Run in watch mode (all services)

```bash
npm run dev
```

### Run a single service

```bash
cd services/auth-service
npm run dev
```

### Prisma migrations

```bash
cd services/inventory-service
npx prisma migrate dev --name add_current_stock_to_alert
npx prisma generate
```

### Build all

```bash
npm run build
```

---

## Roadmap (Week 4+)

- [ ] Kubernetes HPA + Ingress configuration
- [ ] GitHub Actions CI/CD pipeline (matrix strategy)
- [ ] Grafana dashboards + Prometheus metrics
- [ ] Dead-letter queue for failed Kafka messages
- [ ] Idempotency keys for order creation
- [ ] Audit log table for sensitive operations
- [ ] Redis caching for product reads
- [ ] Deploy to EKS / GKE

---

## License

MIT — LogicVeda Technologies, March 2026
