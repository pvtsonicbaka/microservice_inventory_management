# 🏭 InvenFlow — Microservices Inventory Management System

**Distributed, Resilient E-Commerce Backend Platform**

| | |
|---|---|
| **Author** | @harsadash |
| **Date** | March 2026 |
| **Project Code** | lv1-2026-03-02 |
| **Version** | 2.0 |

---

## 📌 Executive Summary

A production-grade microservices-based inventory & order management system demonstrating service decomposition, event-driven communication, resilience patterns, API gateway usage, observability, and Kubernetes-ready deployment — mirroring architectures used at scale by Amazon and Shopify.

---

## 1. Project Overview

### Vision & Objectives

Build a modular, independently deployable backend for e-commerce/retail inventory operations — handling product catalog, stock management, orders, and reporting with high availability and fault tolerance.

### Target Users

- E-commerce startups
- Retail chains with multiple warehouses
- Supply chain SaaS platforms

### Business Value Delivered

- Independent scaling of services (e.g., Orders vs Catalog)
- Eventual consistency for stock updates via Kafka sagas
- Zero-downtime deployments with Kubernetes HPA
- Deep DevOps & distributed systems implementation

### Non-Functional Goals

| Goal | Target |
|------|--------|
| Throughput | ≥ 1,000 req/min per service |
| Resilience | Circuit breaking, retries, timeouts |
| Observability | Distributed tracing + structured logs |
| Data consistency | Eventual via saga pattern |

---

## 2. Key Features

| ID | Feature | Description | Acceptance Criteria |
|----|---------|-------------|---------------------|
| F01 | API Gateway | JWT validation, rate limiting, routing | All requests routed correctly; JWT validated at edge |
| F02 | Authentication | JWT issuance, refresh, role management | Register/login, token validation across services |
| F03 | Inventory | Product CRUD, stock levels, low-stock alerts | Stock updates atomic; optimistic locking |
| F04 | Orders | Order creation, status tracking, saga pattern | PENDING → CONFIRMED on stock success, FAILED on insufficient stock |
| F05 | Event Bus | Async communication via Kafka | At-least-once delivery; idempotency |
| F06 | Reporting & Search | Elasticsearch product search + analytics | Aggregations, faceted search, real-time metrics |
| F07 | Resilience | Circuit breakers, retries, timeouts | Graceful degradation during partial failures |
| F08 | Observability | Structured logging, correlation IDs | Request correlation ID across all services |

---

## 3. Technology Stack

| Category | Technology | Version | Rationale |
|----------|-----------|:-------:|-----------|
| Runtime | Node.js | 22 | LTS, high performance async I/O |
| Language | TypeScript | 5.5+ | Type safety across all services |
| HTTP Framework | Express | 4.19 | Lightweight, battle-tested |
| ORM | Prisma | 5.14 | Type-safe DB access, migrations |
| Database | PostgreSQL | 16 | ACID compliance per service |
| Message Broker | Kafka (Confluent) | 7.6 | Durability, ordering guarantees |
| Cache / Blacklist | Redis | 7 | JWT blacklist, rate limiting |
| Search & Analytics | Elasticsearch | 8.14 | Full-text search, aggregations |
| Auth | jsonwebtoken + bcryptjs | 9 / 2.4 | Industry standard JWT |
| Validation | Zod | 3.23 | Runtime schema validation |
| Frontend | React + Vite + Tailwind | 18 / 5 / 3 | Modern, fast admin UI |
| Build System | Turborepo | 2 | Monorepo task orchestration |
| Containers | Docker + Compose | — | Multi-stage builds |
| Orchestration | Kubernetes + HPA | — | Production-grade scaling |
| CI/CD | GitHub Actions | — | Matrix strategy, multi-platform builds |

---

## 4. Architecture

```
                    ┌──────────────────────────────────────┐
                    │           CLIENT / BROWSER            │
                    │        http://localhost:5173          │
                    └─────────────────┬────────────────────┘
                                      │ HTTPS
                    ┌─────────────────▼────────────────────┐
                    │             API GATEWAY               │
                    │   :4000  JWT · Rate Limit · CORS      │
                    └──┬──────────┬──────────┬───────────┬─┘
                       │          │          │           │
          ┌────────────▼┐  ┌──────▼──────┐  ┌▼────────┐ ┌▼────────────┐
          │AUTH SERVICE │  │  INVENTORY  │  │ ORDERS  │ │  REPORTING  │
          │    :4001    │  │   SERVICE   │  │ SERVICE │ │   SERVICE   │
          │ JWT · Redis │  │    :4002    │  │  :4003  │ │    :4004    │
          │ Blacklist   │  │Products·   │  │Saga·    │ │ES Search·   │
          └──────┬──────┘  │Stock·Alerts│  │Circuit  │ │Analytics    │
                 │         └──────┬─────┘  │Breaker  │ └─────────────┘
          ┌──────▼──────┐  ┌──────▼─────┐  └────┬────┘
          │  auth_db    │  │inventory_db│  ┌─────▼─────┐
          │ (Postgres)  │  │ (Postgres) │  │ orders_db │
          └─────────────┘  └────────────┘  └───────────┘

                    ┌──────────────────────────────────────┐
                    │           KAFKA EVENT BUS             │
                    │  order.placed · stock.updated         │
                    │  order.confirmed · order.cancelled    │
                    │  stock.low-alert · product.*          │
                    └──────────────────────────────────────┘
```

### Saga Pattern — Order Flow

```
POST /orders
  └─► Orders Service: create order (PENDING) → publish order.placed
        └─► Inventory Service: check stock
              ├── SUFFICIENT → reserve stock → publish stock.updated
              │     └─► Orders Service: status = CONFIRMED
              └── INSUFFICIENT → publish order.cancelled
                    └─► Orders Service: status = FAILED (compensating transaction)
```

---

## 5. Services Overview

| Service | Port | Description |
|---------|:----:|-------------|
| api-gateway | 4000 | Entry point — JWT validation, rate limiting, routing |
| auth-service | 4001 | Users, roles, JWT issuance, Redis token blacklist |
| inventory-service | 4002 | Products, stock, warehouses, low-stock alerts |
| orders-service | 4003 | Orders, saga orchestration, circuit breaker |
| reporting-service | 4004 | Elasticsearch search + analytics dashboard |
| admin-dashboard | 5173 | React + Vite + Tailwind admin UI |

---

## 6. Detailed 28-Day Execution Timeline

### Week 1 — Architecture, Auth & Core Services

| Day | Deliverable |
|-----|-------------|
| Day 1 | Domain-driven design, bounded contexts, service map, OpenAPI specs |
| Day 2 | Monorepo setup (Turborepo), auth service boilerplate + JWT |
| Day 3 | PostgreSQL schema + Prisma migrations, inventory service CRUD |
| Day 4 | API Gateway setup + routing rules + JWT validation middleware |
| Day 5 | Docker Compose for local dev (all services + DB + Redis) |
| Day 6 | Basic inter-service call (Inventory → Auth validation) |
| Day 7 | Week 1 tag, Postman collection, local smoke test |

### Week 2 — Event-Driven Core & Orders

| Day | Deliverable |
|-----|-------------|
| Day 8–9 | Kafka setup + topics (order.placed, stock.updated) |
| Day 10 | Orders service — order creation flow |
| Day 11 | Saga implementation (compensating transactions) |
| Day 12 | Event consumers in Inventory & Orders services |
| Day 13 | React admin dashboard bootstrap + auth |
| Day 14 | End-to-end order placement test |

### Week 3 — Resilience, Search & Analytics

| Day | Deliverable |
|-----|-------------|
| Day 15 | Circuit breakers + retries (custom implementation) |
| Day 16 | Elasticsearch integration + product indexing |
| Day 17 | Search endpoint + faceted filters |
| Day 18 | Reporting service + analytics dashboards |
| Day 19 | ELK logging setup + correlation IDs |
| Day 20 | Chaos testing (kill service, network delay) |
| Day 21 | Week 3 tag + resilience report |

### Week 4 — Orchestration & Production

| Day | Deliverable |
|-----|-------------|
| Day 22 | Kubernetes manifests for all services |
| Day 23 | Ingress + HPA configuration |
| Day 24 | GitHub Actions multi-service CI/CD pipeline |
| Day 25 | Deploy to cluster + live demo |
| Day 26 | Grafana dashboards + alerts |
| Day 27 | Demo video recording |
| Day 28 | Final QA, README, PDF export |

---

## 7. Technical Highlights

### Security (OWASP Mitigations)

| Concern | Mitigation |
|---------|-----------|
| JWT forgery | HS256 with strong secrets; validated on every request |
| Token replay after logout | Redis blacklist keyed by JTI with TTL |
| Brute force login | Auth rate limiter: 50 req/15min per IP |
| SQL injection | Prisma parameterized queries — no raw SQL |
| Oversized payloads | express.json({ limit: "10kb" }) on all routes |
| CORS | Allowlist-based origin validation |
| Role escalation | requireRole() middleware on all sensitive routes |
| Secrets in repo | .env.example only; actual secrets via environment variables |

### Resilience Patterns

- **Circuit Breaker** — Opens after 5 failures, recovers after 30s (CLOSED → OPEN → HALF_OPEN)
- **Saga Pattern** — Compensating transactions for distributed order flow
- **Graceful Degradation** — Elasticsearch down returns empty results with warning, never 500
- **Kafka Retry** — Exponential backoff: 10 retries, 300ms initial, factor 2
- **Rate Limiting** — 100 req/min global, 50 req/15min on auth endpoints
- **Graceful Shutdown** — SIGTERM handling, clean Kafka disconnect, zero message loss

### Observability

- Structured JSON logging across all services with consistent fields (timestamp, level, service, msg, correlationId)
- x-correlation-id header propagated through every request and Kafka event
- Health check endpoint on every service returning service status
- Request duration logged on every response

### Performance

- Turborepo build caching — only rebuilds changed services
- Multi-stage Docker builds — lean production images
- Elasticsearch for sub-100ms product search
- Redis for O(1) JWT blacklist lookups
- Stock reservation (not immediate deduction) prevents oversell under load

---

## 8. Deployment & Operations

### Local Setup

```bash
git clone https://github.com/pvtsonicbaka/microservice_inventory_management
cd microservice_inventory_management
bash setup.sh
```

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@invenflow.com | Admin@123 |
| Manager | manager@invenflow.com | Manager@123 |
| Viewer | viewer@invenflow.com | Viewer@123 |

### Access Points

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Admin Dashboard |
| http://localhost:4000/health | API Gateway health |
| http://localhost:4001 | Auth Service |
| http://localhost:4002 | Inventory Service |
| http://localhost:4003 | Orders Service |
| http://localhost:4004 | Reporting Service |

### CI/CD Pipeline

- **Lint & type check** — 5 backend services + dashboard in parallel
- **Integration tests** — auth service against live PostgreSQL + Redis
- **Docker build & push** — 6 images to ghcr.io (linux/amd64 + linux/arm64)
- **Smoke test** — 23-check full stack integration test (main branch only)

### Kubernetes

- 15 manifests covering all services, databases, ingress
- HPA: api-gateway scales 2→8 pods, orders-service 2→10 pods
- One-command deploy: `bash infra/k8s/deploy.sh`

---

## 9. Testing

| Suite | Tests | Coverage |
|-------|:-----:|---------|
| auth-service | 18 | Register, login, validate, refresh, logout, RBAC |
| inventory-service | 22 | Products CRUD, stock ops, warehouses, alerts |
| orders-service | 16 | Saga flow, cancellation, RBAC, ownership |
| reporting-service | 35 | Search, dashboard, pagination, ES degradation |
| Smoke test | 23 | Full gateway → service flow |
| E2E saga test | 10 | Register → order → CONFIRMED → stock deducted |
| Chaos test | 10 | Kill services, rate limit, correlation ID |
| **Total** | **134** | |

---

## 10. Personal Reflection

### Key Learnings

Building this system taught me that distributed systems require explicit handling of partial failures — circuit breakers and sagas are not optional extras, they are core to correctness. Event-driven architecture decouples services beautifully but demands careful idempotency design to avoid double-processing. Observability through correlation IDs made debugging across service boundaries practical rather than guesswork.

### Industry Best Practices Applied

- Domain-driven design with clear bounded contexts per service
- 12-factor app principles — config via env vars, stateless services, disposability
- GitOps with semantic commit messages and automated CI/CD on every push
- Security-first design — JWT blacklisting, rate limiting, parameterized queries

### Challenges Faced & Solved

- **Prisma + ARM64 Docker** — OpenSSL version mismatch between build and runtime; solved by switching to node:22-bookworm base image with OpenSSL 3.x pre-installed
- **Saga consistency** — Ensuring stock reservation and order confirmation stay in sync across Kafka events; solved with atomic Prisma transactions and idempotency checks
- **Elasticsearch degradation** — Reporting service needed to stay functional when ES was down; solved with Promise.allSettled and graceful fallback responses

### Future Roadmap

- Add Prometheus + Grafana metrics dashboards
- Implement distributed tracing with Jaeger
- Add webhook support for external integrations
- Implement bulk product import/export via CSV
- Add real-time notifications via WebSockets

---

*Built with Node.js · TypeScript · Kafka · Kubernetes · ❤️*

*LogicVeda Technologies · March 2026*

*GitHub: https://github.com/pvtsonicbaka/microservice_inventory_management*
