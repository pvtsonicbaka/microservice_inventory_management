<div align="center">

# 🏭 InvenFlow

### Microservices Inventory Management System

**Event-Driven · Fault-Tolerant · Kubernetes-Ready · Production-Grade**

<br/>

[![CI](https://github.com/pvtsonicbaka/microservice_inventory_management/actions/workflows/ci.yml/badge.svg)](https://github.com/pvtsonicbaka/microservice_inventory_management/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5?logo=kubernetes&logoColor=white)](infra/k8s)
[![Kafka](https://img.shields.io/badge/Kafka-Event--Driven-231F20?logo=apachekafka&logoColor=white)](https://kafka.apache.org)
[![Redis](https://img.shields.io/badge/Redis-Blacklist-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Elasticsearch](https://img.shields.io/badge/Elasticsearch-Search-005571?logo=elasticsearch&logoColor=white)](https://www.elastic.co)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<br/>

> A production-grade microservices backend for e-commerce inventory operations — featuring service decomposition,
> event-driven communication via Kafka, saga-based distributed transactions, Elasticsearch-powered search,
> circuit breakers, JWT blacklisting, and a React admin dashboard.

**Project Code:** `lv1-2026-03-02` &nbsp;|&nbsp; **Version:** 2.0 &nbsp;|&nbsp; **Author:** [@pvtsonicbaka](https://github.com/pvtsonicbaka) &nbsp;|&nbsp; **Date:** March 2026

</div>

---

## 📋 Table of Contents

- [Architecture](#-architecture)
- [Services](#-services)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [API Reference](#-api-reference)
- [Event-Driven Architecture](#-event-driven-architecture)
- [Resilience Patterns](#-resilience-patterns)
- [Testing](#-testing)
- [Kubernetes Deployment](#-kubernetes-deployment)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Security](#-security)
- [Project Structure](#-project-structure)

---

## 🏗 Architecture

```
                    ┌──────────────────────────────────────┐
                    │           CLIENT / BROWSER            │
                    │        https://collie-gigabyte-freely.ngrok-free.dev          │
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
          │             │  │    :4002    │  │  :4003  │ │    :4004    │
          │ JWT · Redis │  │Products·   │  │Saga·    │ │ES Search·   │
          │ Blacklist   │  │Stock·Alerts│  │Circuit  │ │Analytics    │
          └──────┬──────┘  └──────┬─────┘  │Breaker  │ └──────┬──────┘
                 │                │        └────┬────┘        │
          ┌──────▼──────┐  ┌──────▼─────┐  ┌───▼────┐  ┌─────▼───────┐
          │  auth_db    │  │inventory_db│  │orders  │  │Elasticsearch│
          │ (Postgres)  │  │ (Postgres) │  │  _db   │  │   :9200     │
          └─────────────┘  └────────────┘  └────────┘  └─────────────┘

                    ┌──────────────────────────────────────┐
                    │           KAFKA EVENT BUS             │
                    │  order.placed · stock.updated         │
                    │  order.confirmed · order.cancelled    │
                    │  stock.low-alert · product.*          │
                    └──────────────────────────────────────┘
```

### 🔄 Saga Pattern — Order Flow

```
POST /orders
  └─► Orders Service: create order (PENDING) → publish order.placed
        └─► Inventory Service: check stock
              ├── SUFFICIENT → reserve stock → publish stock.updated
              │     └─► Orders Service: CONFIRMED
              │           └─► Inventory: deduct stock (order.confirmed)
              └── INSUFFICIENT → publish order.cancelled
                    └─► Orders Service: FAILED (compensating transaction)
```

---

## 🧩 Services

| Service | Port | Description |
|---------|:----:|-------------|
| 🔀 **api-gateway** | 4000 | Entry point — JWT validation, rate limiting, routing |
| 🔐 **auth-service** | 4001 | Users, roles, JWT issuance, Redis token blacklist |
| 📦 **inventory-service** | 4002 | Products, stock, warehouses, low-stock alerts |
| 🛒 **orders-service** | 4003 | Orders, saga orchestration, circuit breaker |
| 📊 **reporting-service** | 4004 | Elasticsearch search + analytics dashboard |
| 🖥 **admin-dashboard** | 5173 | React + Vite + Tailwind admin UI |

### 🏗 Infrastructure

| Service | Port | Purpose |
|---------|:----:|---------|
| 🐘 PostgreSQL ×3 | 5432 | Per-service isolated databases |
| 🔴 Redis | 6380 | JWT blacklist + rate limiting |
| 📨 Kafka | 9093 | Event bus (8 topics) |
| 🔍 Elasticsearch | 9200 | Product search + order analytics |

---

## 🛠 Tech Stack

| Category | Technology | Version |
|----------|-----------|:-------:|
| Runtime | Node.js | 22 |
| Language | TypeScript | 5.5+ |
| HTTP Framework | Express | 4.19 |
| ORM | Prisma | 5.14 |
| Database | PostgreSQL | 16 |
| Message Broker | Kafka (Confluent) | 7.6 |
| Cache / Blacklist | Redis | 7 |
| Search & Analytics | Elasticsearch | 8.14 |
| Auth | jsonwebtoken + bcryptjs | 9 / 2.4 |
| Validation | Zod | 3.23 |
| HTTP Client | Axios | 1.7 |
| Frontend | React + Vite + Tailwind | 18 / 5 / 3 |
| Build System | Turborepo | 2 |
| Containers | Docker + Docker Compose | — |
| Orchestration | Kubernetes + HPA | — |
| CI/CD | GitHub Actions | — |

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 22+

### ⚡ One-command setup

```bash
git clone https://github.com/pvtsonicbaka/microservice_inventory_management.git
cd microservice_inventory_management
bash setup.sh
```

This automatically:
- Starts all containers (services + databases + Kafka + Elasticsearch + Redis)
- Pushes all database schemas
- Creates an admin account
- Seeds demo data

### 🌐 Access

| URL | Description |
|-----|-------------|
| https://collie-gigabyte-freely.ngrok-free.dev | Admin Dashboard |
| http://localhost:4000/health | API Gateway health |

**Demo credentials:**

```
Admin:   admin@invenflow.com   / Admin@123
```

### 🔧 Manual setup (if needed)

```bash
# 1. Start services
sudo docker compose -f infra/docker/docker-compose.yml up -d --build

# 2. Push schemas
sudo docker exec docker-auth-service-1 npx prisma db push --skip-generate
sudo docker exec docker-orders-service-1 npx prisma db push --skip-generate

# 3. Seed demo data
bash scripts/seed.sh
```

---

## 📡 API Reference

All requests go through **`http://localhost:4000`**

### 🔐 Authentication

| Method | Endpoint | Auth | Description |
|:------:|----------|:----:|-------------|
| `POST` | `/auth/register` | — | Register (returns viewer role) |
| `POST` | `/auth/login` | — | Login → access + refresh tokens |
| `POST` | `/auth/refresh` | — | Refresh access token |
| `POST` | `/auth/logout` | Bearer | Blacklist token + delete refresh |
| `GET` | `/auth/validate` | Bearer | Validate token (internal) |
| `GET` | `/auth/users` | Admin | List all users |
| `PATCH` | `/auth/users/:id/role` | Admin | Change user role |

### 📦 Products

| Method | Endpoint | Auth | Description |
|:------:|----------|:----:|-------------|
| `GET` | `/products` | Any | List products (paginated) |
| `GET` | `/products/:id` | Any | Get product by ID |
| `POST` | `/products` | Admin/Manager | Create product |
| `PUT` | `/products/:id` | Admin/Manager | Update product |
| `DELETE` | `/products/:id` | Admin | Delete product |
| `POST` | `/products/seed` | Admin | Seed 12 demo products |

### 🏪 Stock & Warehouses

| Method | Endpoint | Auth | Description |
|:------:|----------|:----:|-------------|
| `GET` | `/products/:id/stock` | Any | Stock levels per warehouse |
| `PATCH` | `/products/:id/stock` | Admin/Manager | Update stock (increment/decrement/set) |
| `GET` | `/stock/alerts` | Admin/Manager | Low-stock alerts |
| `GET` | `/warehouses` | Any | List warehouses |
| `POST` | `/warehouses` | Admin | Create warehouse |
| `DELETE` | `/warehouses/:id` | Admin | Delete warehouse |

### 🛒 Orders

| Method | Endpoint | Auth | Description |
|:------:|----------|:----:|-------------|
| `GET` | `/orders` | Any | List orders (own; admin sees all) |
| `POST` | `/orders` | Any | Place order → triggers saga |
| `GET` | `/orders/:id` | Owner/Admin | Order details |
| `GET` | `/orders/:id/status` | Owner/Admin | Status + saga steps |
| `POST` | `/orders/:id/cancel` | Owner/Admin | Cancel order |

### 📊 Search & Reporting

| Method | Endpoint | Auth | Description |
|:------:|----------|:----:|-------------|
| `GET` | `/search/products` | Any | Elasticsearch full-text search |
| `GET` | `/reports/dashboard` | Admin/Manager | Analytics dashboard |
| `GET` | `/reports/stock-alerts` | Admin/Manager | Paginated alerts |
| `POST` | `/reports/products/reindex` | Admin | Trigger reindex |

---

## 📨 Event-Driven Architecture

Full schemas: [`shared/events/kafka-events.md`](shared/events/kafka-events.md)

| Topic | Publisher | Consumers |
|-------|-----------|-----------|
| `order.placed` | orders-service | inventory-service, reporting-service |
| `stock.updated` | inventory-service | orders-service |
| `order.confirmed` | orders-service | inventory-service, reporting-service |
| `order.cancelled` | inventory/orders | orders-service, inventory-service, reporting-service |
| `stock.low-alert` | inventory-service | reporting-service |
| `product.created` | inventory-service | reporting-service |
| `product.updated` | inventory-service | reporting-service |
| `product.deleted` | inventory-service | reporting-service |

**Guarantees:**
- ✅ At-least-once delivery via Kafka consumer groups
- ✅ Each event has a unique `eventId` (UUID v4)
- ✅ Idempotency: `order.cancelled` with `reason: insufficient_stock` is ignored by inventory-service
- ✅ Low-stock deduplication: max 1 alert per product per hour

---

## 🛡 Resilience Patterns

### ⚡ Circuit Breaker
Orders-service wraps all inventory-service calls:
- Opens after **5 consecutive failures**
- Recovers after **30 seconds** (half-open probe)
- Returns `503` immediately when open

### 🌊 Graceful Degradation
Reporting-service handles Elasticsearch being down:
- Search returns `{ data: [], warning: "Search index unavailable" }`
- Dashboard returns zeroed metrics with a `warning` field

### 🔒 JWT Blacklist
- Logout blacklists the access token JTI in Redis with TTL = remaining lifetime
- Every `/auth/validate` call checks the blacklist
- Degrades gracefully if Redis is unavailable

### 🚦 Rate Limiting
- Global: **100 req/min** per IP
- Auth endpoints: **50 req/15min** per IP (brute-force protection)

### 🔁 Kafka Crash Recovery
- All consumers use `consumer.on("consumer.crash") → process.exit(1)`
- Docker/Kubernetes auto-restarts the container

### 📋 Chaos Test Results

| # | Scenario | Result |
|:-:|----------|:------:|
| 1 | Baseline health check | ✅ Pass |
| 2 | Invalid JWT token | ✅ Pass |
| 3 | Missing auth header | ✅ Pass |
| 4 | 105 rapid requests → rate limit | ✅ Pass |
| 5 | Kill inventory service | ✅ Pass |
| 6 | Orders isolated from inventory failure | ✅ Pass |
| 7 | Inventory service recovery | ✅ Pass |
| 8 | Kill orders service | ✅ Pass |
| 9 | Products isolated from orders failure | ✅ Pass |
| 10 | Correlation ID propagation | ✅ Pass |

---

## 🧪 Testing

### Quick test suite

```bash
# Smoke test — 23 checks in ~30 seconds
bash docs/smoke-test.sh

# Full saga test — order → Kafka → CONFIRMED → stock deducted
bash docs/e2e-saga-test.sh

# Chaos test — kill services, check recovery
bash docs/chaos-test.sh
```

### Per-service integration tests

```bash
# Get admin token first
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@invenflow.com","password":"Admin@123"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# Auth tests
cd services/auth-service
AUTH_URL=http://localhost:4001 npm run test

# Inventory tests
cd services/inventory-service
GATEWAY_URL=http://localhost:4000 AUTH_URL=http://localhost:4001 ADMIN_TOKEN=$TOKEN npm run test

# Orders tests
PRODUCT_ID=$(curl -s http://localhost:4000/products \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
cd services/orders-service
GATEWAY_URL=http://localhost:4000 AUTH_URL=http://localhost:4001 \
ADMIN_TOKEN=$TOKEN TEST_PRODUCT_ID=$PRODUCT_ID npm run test

# Reporting tests
cd services/reporting-service
REPORTING_URL=http://localhost:4004 AUTH_URL=http://localhost:4001 \
GATEWAY_URL=http://localhost:4000 ADMIN_TOKEN=$TOKEN npm run test
```

### Test coverage

| Service | Tests | Areas Covered |
|---------|:-----:|---------------|
| auth-service | 18 | Register, login, validate, refresh, logout, RBAC |
| inventory-service | 22 | Products CRUD, stock ops, warehouses, alerts |
| orders-service | 16 | Saga flow, cancellation, RBAC, ownership |
| reporting-service | 35 | Search, dashboard, pagination, ES degradation |

---

## ☸️ Kubernetes Deployment

All manifests are in [`infra/k8s/`](infra/k8s/). Images are pulled from GitHub Container Registry.

### Prerequisites

```bash
# nginx ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml

# metrics-server (required for HPA)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### Deploy

```bash
# Dry run first
bash infra/k8s/deploy.sh --dry-run

# Deploy everything
bash infra/k8s/deploy.sh

# Check status
kubectl get pods -n invenflow
kubectl get hpa -n invenflow
kubectl get ingress -n invenflow

# Teardown
bash infra/k8s/deploy.sh --teardown
```

### HPA Configuration

| Service | Min Pods | Max Pods | CPU Target |
|---------|:--------:|:--------:|:----------:|
| api-gateway | 2 | 8 | 60% |
| auth-service | 2 | 6 | 70% |
| inventory-service | 2 | 8 | 70% |
| orders-service | 2 | 10 | 70% |
| reporting-service | 1 | 4 | 70% |

### Update image tags after CI

```bash
kubectl set image deployment/auth-service \
  auth-service=ghcr.io/pvtsonicbaka/microservice_inventory_management/auth-service:sha-<commit> \
  -n invenflow
```

---

## ⚙️ CI/CD Pipeline

GitHub Actions workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

```
Push to main / develop
         │
         ▼
┌─────────────────┐
│  Lint & Type    │  ← 5 services in parallel (matrix strategy)
│     Check       │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌──────────────────┐
│ Test  │  │  Build & Push    │  ← 6 Docker images → ghcr.io
│ Auth  │  │  Docker Images   │
└───────┘  └────────┬─────────┘
                    │  (main only)
                    ▼
           ┌─────────────────┐
           │   Smoke Test    │  ← Full stack integration test
           │  (Full Stack)   │
           └─────────────────┘
```

### Docker images (auto-built on every push to main)

```
ghcr.io/pvtsonicbaka/microservice_inventory_management/auth-service:latest
ghcr.io/pvtsonicbaka/microservice_inventory_management/inventory-service:latest
ghcr.io/pvtsonicbaka/microservice_inventory_management/orders-service:latest
ghcr.io/pvtsonicbaka/microservice_inventory_management/reporting-service:latest
ghcr.io/pvtsonicbaka/microservice_inventory_management/api-gateway:latest
ghcr.io/pvtsonicbaka/microservice_inventory_management/admin-dashboard:latest
```

---

## 🔒 Security

| Concern | Mitigation |
|---------|-----------|
| JWT forgery | HS256 with strong secrets; validated on every request |
| Token replay after logout | Redis blacklist keyed by JTI with TTL |
| Brute force login | Auth rate limiter: 50 req/15min per IP |
| SQL injection | Prisma parameterized queries (no raw SQL) |
| Oversized payloads | `express.json({ limit: "10kb" })` on all routes |
| CORS | Allowlist-based origin validation |
| Role escalation | `requireRole()` middleware on all sensitive routes |
| Secrets in repo | `.env.example` only; actual secrets via env vars |
| K8s secrets | Base64-encoded in `secrets.yaml` — use Vault/AWS SM in prod |

---

## 📁 Project Structure

```
microservice_inventory_management/
├── .github/
│   └── workflows/ci.yml          # GitHub Actions CI/CD
├── services/
│   ├── api-gateway/              # JWT validation, rate limiting, routing
│   ├── auth-service/             # Users, JWT, Redis blacklist
│   ├── inventory-service/        # Products, stock, warehouses, Kafka saga
│   ├── orders-service/           # Orders, saga, circuit breaker
│   ├── reporting-service/        # Elasticsearch search + analytics
│   └── admin-dashboard/          # React + Vite + Tailwind UI
├── shared/
│   └── events/kafka-events.md    # Kafka event schema docs
├── docs/
│   ├── architecture/             # System architecture diagrams
│   ├── openapi/                  # Per-service OpenAPI specs
│   ├── smoke-test.sh             # 23-check smoke test
│   ├── e2e-saga-test.sh          # Full saga integration test
│   └── chaos-test.sh             # Resilience/chaos test
├── infra/
│   ├── docker/docker-compose.yml
│   └── k8s/                      # 15 Kubernetes manifests
│       ├── namespace.yaml
│       ├── configmap.yaml
│       ├── secrets.yaml
│       ├── postgres.yaml         # 3 Postgres instances
│       ├── redis.yaml
│       ├── kafka.yaml            # Zookeeper + Kafka
│       ├── elasticsearch.yaml
│       ├── auth-service.yaml     # Deployment + Service + HPA
│       ├── inventory-service.yaml
│       ├── orders-service.yaml
│       ├── reporting-service.yaml
│       ├── api-gateway.yaml
│       ├── admin-dashboard.yaml
│       ├── ingress.yaml          # nginx Ingress
│       └── deploy.sh             # One-command deploy
├── scripts/seed.sh               # Demo data seeder
├── setup.sh                      # One-command local setup
└── turbo.json                    # Turborepo pipeline config
```

---

<div align="center">

**MIT License** &nbsp;·&nbsp; [@pvtsonicbaka](https://github.com/pvtsonicbaka) &nbsp;·&nbsp; LogicVeda Technologies &nbsp;·&nbsp; March 2026

*Built with Node.js · TypeScript · Kafka · Kubernetes · ❤️*

</div>
