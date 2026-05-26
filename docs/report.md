# 🏭 InvenFlow — Microservices Inventory Management System

**Distributed, Resilient E-Commerce Backend Platform**

| Field        | Details                  |
| :----------- | :----------------------- |
| **Author**   | @harsadash               |
| **Date**     | March 2026               |
| **Code**     | lv1-2026-03-02           |
| **Version**  | 2.0                      |

> *"Built like Amazon. Scaled like Shopify. Deployed like Netflix."*

---

## 📌 What is InvenFlow?

InvenFlow is a **production-grade distributed backend** for e-commerce inventory operations. It's not just a CRUD app — it's a fully event-driven, fault-tolerant system with real resilience patterns, a Kafka event bus, Elasticsearch-powered search, and a React admin dashboard.

Think of it as the backend that powers a retail chain with multiple warehouses, thousands of products, and hundreds of concurrent orders — all running independently, all talking to each other through events.

---

## 🎯 The Problem It Solves

| Problem                          | InvenFlow Solution                                          |
| :------------------------------- | :---------------------------------------------------------- |
| One crash takes everything down  | 5 isolated microservices — one fails, others keep running   |
| Stock oversell under high load   | Atomic stock reservation before order confirmation          |
| Slow product search              | Elasticsearch with sub-100ms full-text search               |
| No visibility into failures      | Correlation IDs trace every request across all services     |
| Scaling bottlenecks              | Kubernetes HPA scales each service independently            |

---

## 🏗️ Architecture Overview

### Services & Ports

| Service              | Port  | Role                                              |
| :------------------- | :---: | :------------------------------------------------ |
| Admin Dashboard      | 5173  | React + Vite + Tailwind UI                        |
| API Gateway          | 4000  | JWT validation, rate limiting, routing            |
| Auth Service         | 4001  | Users, roles, JWT issuance, Redis blacklist        |
| Inventory Service    | 4002  | Products, stock, warehouses, low-stock alerts     |
| Orders Service       | 4003  | Orders, saga orchestration, circuit breaker       |
| Reporting Service    | 4004  | Elasticsearch search + analytics                  |

### Infrastructure

| Component          | Purpose                              |
| :----------------- | :----------------------------------- |
| PostgreSQL × 3     | One isolated database per service    |
| Redis              | JWT blacklist + rate limiting        |
| Kafka              | Event bus — 8 topics                 |
| Elasticsearch      | Product search + order analytics     |

### Request Flow

Every request from the browser goes through this path:

**Browser → API Gateway (JWT check) → Target Service → Database**

The API Gateway is the single entry point. It validates the JWT token locally, applies rate limiting, and proxies the request to the correct service. Services never touch each other's databases.

---

## 📸 Screenshots

### Dashboard Overview
<!-- ADD SCREENSHOT: http://localhost:5173 — main dashboard with stats cards -->

&nbsp;

### Products Page
<!-- ADD SCREENSHOT: http://localhost:5173/products — product list with stock levels -->

&nbsp;

### Place Order Flow
<!-- ADD SCREENSHOT: http://localhost:5173/place-order — order creation form -->

&nbsp;

### Orders & Saga Status
<!-- ADD SCREENSHOT: http://localhost:5173/orders — order list with CONFIRMED/FAILED status -->

&nbsp;

### Analytics & Reports
<!-- ADD SCREENSHOT: http://localhost:5173/analytics — charts and KPI cards -->

&nbsp;

### Search (Elasticsearch)
<!-- ADD SCREENSHOT: http://localhost:5173/search — product search with filters -->

&nbsp;

### Stock Alerts
<!-- ADD SCREENSHOT: http://localhost:5173/alerts — low stock alert list -->

&nbsp;

### API Gateway Health Check
<!-- ADD SCREENSHOT: curl http://localhost:4000/health — all services up -->

&nbsp;

---

## ⚡ The Saga Pattern — How Orders Work

No distributed locks. No 2-phase commit. Just events.

### Happy Path (Stock Available)

| Step | Service             | Action                                            |
| :--: | :------------------ | :------------------------------------------------ |
|  1   | Orders Service      | Creates order with status **PENDING**             |
|  2   | Orders Service      | Publishes `order.placed` to Kafka                 |
|  3   | Inventory Service   | Receives event, checks available stock            |
|  4   | Inventory Service   | Reserves stock atomically (prevents oversell)     |
|  5   | Inventory Service   | Publishes `stock.updated` to Kafka                |
|  6   | Orders Service      | Receives event, updates status → **CONFIRMED** ✅ |

### Failure Path (Insufficient Stock)

| Step | Service             | Action                                            |
| :--: | :------------------ | :------------------------------------------------ |
|  1   | Orders Service      | Creates order with status **PENDING**             |
|  2   | Orders Service      | Publishes `order.placed` to Kafka                 |
|  3   | Inventory Service   | Receives event, checks stock — not enough         |
|  4   | Inventory Service   | Publishes `order.cancelled` to Kafka              |
|  5   | Orders Service      | Receives event, updates status → **FAILED** ❌    |

No stock was ever deducted. The compensating transaction is automatic.

---

## 🛡️ Resilience — Built for Failure

### Circuit Breaker States

| State      | Behaviour                              | Trigger                    |
| :--------- | :------------------------------------- | :------------------------- |
| CLOSED     | Requests pass through normally         | Default state              |
| OPEN       | Requests fail immediately with 503     | 5 consecutive failures     |
| HALF-OPEN  | One probe request allowed              | After 30 second timeout    |

### What Happens When Each Service Goes Down

| Service Down        | Impact                                              | Recovery                               |
| :------------------ | :-------------------------------------------------- | :------------------------------------- |
| auth-service        | Login fails, existing sessions still work           | Auto-restart via Docker                |
| inventory-service   | Gateway returns 503, circuit breaker opens          | Auto-restart, circuit closes after 30s |
| orders-service      | Order placement fails, products/auth still work     | Auto-restart                           |
| elasticsearch       | Search returns empty + warning, no crash            | Graceful degradation                   |
| kafka               | Events queue up, services retry with backoff        | Reconnects automatically               |

### Kafka Retry Policy

| Setting          | Value                              |
| :--------------- | :--------------------------------- |
| Max retries      | 10                                 |
| Initial delay    | 300ms                              |
| Backoff factor   | 2x (300 → 600 → 1200 → ...)        |
| Max wait         | ~5 minutes total                   |

---

## 🔒 Security — OWASP Covered

| Threat                      | Protection                                                  |
| :-------------------------- | :---------------------------------------------------------- |
| JWT forgery                 | HS256 signed tokens, validated on every request             |
| Token replay after logout   | Redis blacklist keyed by JTI with TTL = remaining lifetime  |
| Brute force attacks         | 50 requests per 15 minutes on auth endpoints                |
| SQL injection               | Prisma ORM — zero raw SQL queries                           |
| Payload attacks             | 10KB body limit on all routes                               |
| Unauthorized access         | Role-based middleware: admin / manager / viewer             |
| CORS attacks                | Strict origin allowlist                                     |
| Secrets in repo             | .env.example only — no secrets committed to git             |

---

## 🛠️ Tech Stack

| Layer           | Technology                  | Version   | Why                                    |
| :-------------- | :-------------------------- | :-------: | :------------------------------------- |
| Runtime         | Node.js                     | 22        | Latest LTS, fast async I/O             |
| Language        | TypeScript                  | 5.5+      | Type safety across all services        |
| API Framework   | Express                     | 4.19      | Lightweight, battle-tested             |
| Database        | PostgreSQL                  | 16        | ACID compliance per service            |
| ORM             | Prisma                      | 5.14      | Type-safe queries, auto migrations     |
| Events          | Kafka (Confluent)           | 7.6       | Durable, ordered, at-least-once        |
| Cache           | Redis                       | 7         | JWT blacklist, rate limiting           |
| Search          | Elasticsearch               | 8.14      | Full-text, faceted, aggregations       |
| Frontend        | React + Vite + Tailwind     | 18/5/3    | Fast, modern admin UI                  |
| Build           | Turborepo                   | 2         | Monorepo caching                       |
| Containers      | Docker + Compose            | —         | Multi-stage builds                     |
| Orchestration   | Kubernetes + HPA            | —         | Auto-scaling in production             |
| CI/CD           | GitHub Actions              | —         | Matrix builds, multi-platform          |

---

## 📅 28-Day Build Timeline

### Week 1 — Foundation

| Day | Deliverable                                          |
| :-: | :--------------------------------------------------- |
|  1  | Domain design, bounded contexts, OpenAPI specs       |
|  2  | Turborepo monorepo, auth service + JWT               |
|  3  | Prisma schemas, inventory CRUD                       |
|  4  | API Gateway + JWT middleware                         |
|  5  | Full Docker Compose stack                            |
|  6  | Inter-service auth validation                        |
|  7  | Postman collection + smoke test                      |

### Week 2 — Event-Driven Core

| Day  | Deliverable                                          |
| :--: | :--------------------------------------------------- |
| 8–9  | Kafka setup, topics, producers/consumers             |
|  10  | Orders service + creation flow                       |
|  11  | Saga pattern + compensating transactions             |
|  12  | Kafka consumers in inventory + orders                |
|  13  | React admin dashboard + auth                         |
|  14  | End-to-end order placement test                      |

### Week 3 — Resilience & Search

| Day | Deliverable                                          |
| :-: | :--------------------------------------------------- |
|  15 | Circuit breakers + retries + timeouts                |
|  16 | Elasticsearch + product indexing                     |
|  17 | Search endpoint + faceted filters                    |
|  18 | Reporting service + analytics                        |
|  19 | Structured logging + correlation IDs                 |
|  20 | Chaos testing — kill services, check recovery        |
|  21 | Resilience report                                    |

### Week 4 — Production

| Day | Deliverable                                          |
| :-: | :--------------------------------------------------- |
|  22 | Kubernetes manifests (15 files)                      |
|  23 | Ingress + HPA configuration                          |
|  24 | GitHub Actions CI/CD pipeline                        |
|  25 | Live deployment                                      |
|  26 | Grafana dashboards                                   |
|  27 | Demo video                                           |
|  28 | Final QA + README + PDF                              |

---

## 🧪 Testing — 134 Tests Total

| Suite                | Tests   | What's Covered                                        |
| :------------------- | :-----: | :---------------------------------------------------- |
| auth-service         |   18    | Register, login, validate, refresh, logout, RBAC      |
| inventory-service    |   22    | Products CRUD, stock ops, warehouses, alerts          |
| orders-service       |   16    | Saga flow, cancellation, RBAC, ownership              |
| reporting-service    |   35    | Search, dashboard, pagination, ES degradation         |
| Smoke test           |   23    | Full gateway to service flow                          |
| E2E saga test        |   10    | Register → order → CONFIRMED → stock deducted         |
| Chaos test           |   10    | Kill services, rate limit, correlation ID             |
| **Total**            | **134** |                                                       |

---

## 🚀 Running It Locally

```bash
git clone https://github.com/pvtsonicbaka/microservice_inventory_management
cd microservice_inventory_management
bash setup.sh
```

Open **http://localhost:5173** and login with:

| Role         | Email                    | Password     |
| :----------- | :----------------------- | :----------- |
| 👑 Admin     | admin@invenflow.com      | Admin@123    |
| 💼 Manager   | manager@invenflow.com    | Manager@123  |
| 👁 Viewer    | viewer@invenflow.com     | Viewer@123   |

---

## ☸️ Kubernetes — Production Ready

### HPA Configuration

| Service              | Min Pods | Max Pods | CPU Target |
| :------------------- | :------: | :------: | :--------: |
| api-gateway          |    2     |    8     |    60%     |
| auth-service         |    2     |    6     |    70%     |
| inventory-service    |    2     |    8     |    70%     |
| orders-service       |    2     |    10    |    70%     |
| reporting-service    |    1     |    4     |    70%     |

### CI/CD Pipeline Stages

| Stage                | What Happens                                                    |
| :------------------- | :-------------------------------------------------------------- |
| Lint & Type Check    | 5 backend services + dashboard checked in parallel              |
| Integration Tests    | Auth service tested against live PostgreSQL + Redis             |
| Docker Build & Push  | 6 images pushed to ghcr.io (linux/amd64 + linux/arm64)          |
| Smoke Test           | 23-check full stack integration test (main branch only)         |

---

## 💡 Personal Reflection

### What I Learned

This project changed how I think about software. Before, I thought microservices were just "splitting a monolith." Now I understand they're a completely different mental model — you design for failure, not against it.

The hardest part wasn't writing code. It was understanding **why** things fail in distributed systems and designing the system to handle those failures gracefully. The circuit breaker pattern, the saga pattern, idempotency — these aren't fancy buzzwords. They're solutions to real problems I hit while building this.

### Biggest Challenges

**1. Prisma + Docker on ARM64**
The Prisma query engine binary was compiled for OpenSSL 1.1.x but the container had OpenSSL 3.x. Spent hours debugging before realizing the fix was switching the base Docker image from `node:22-bookworm-slim` to `node:22-bookworm` which ships with OpenSSL pre-installed.

**2. Saga Consistency**
Making sure stock reservation and order confirmation stay in sync across two services communicating via Kafka was tricky. The solution was atomic Prisma transactions + idempotency checks on the consumer side.

**3. Elasticsearch Graceful Degradation**
The reporting service needed to keep working even when Elasticsearch was down. Used `Promise.allSettled` instead of `Promise.all` so one failing ES query doesn't crash the entire dashboard.

### What I'd Do Differently

- Add Prometheus + Grafana from day 1, not as an afterthought
- Use Prisma migrations instead of `db push` for production
- Add distributed tracing with Jaeger earlier in the project

### What's Next

- Real-time notifications via WebSockets
- Bulk product import/export via CSV
- Grafana dashboards with custom metrics
- Load testing with k6 to validate the 1,000 req/min target

---

*Built with Node.js · TypeScript · Kafka · Kubernetes · ❤️*

*LogicVeda Technologies · March 2026*

*GitHub: https://github.com/pvtsonicbaka/microservice_inventory_management*
