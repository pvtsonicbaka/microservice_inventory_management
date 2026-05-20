# System Architecture – Microservices Inventory Management System

## Bounded Contexts

| Service | Owns | Does NOT touch |
|---|---|---|
| Auth | Users, roles, JWT tokens, sessions | Products, orders, stock |
| Inventory | Products, stock levels, warehouses, low-stock alerts | Users, orders |
| Orders | Orders, order status, payment simulation | Stock numbers directly |
| Reporting | Read-only analytics, search indexes | Any write operations |
| API Gateway | Routing, JWT validation, rate limiting | Business logic |

---

## Service Map (ASCII)

```
                        ┌─────────────────────────────────────────┐
                        │              CLIENT / BROWSER            │
                        └──────────────────┬──────────────────────┘
                                           │ HTTPS
                        ┌──────────────────▼──────────────────────┐
                        │              API GATEWAY                 │
                        │   (Kong / Express Gateway)               │
                        │   - JWT validation                       │
                        │   - Rate limiting                        │
                        │   - Request routing                      │
                        └──┬──────────┬──────────┬────────────┬───┘
                           │          │          │            │
                    HTTP   │   HTTP   │   HTTP   │     HTTP   │
              ┌────────────▼─┐ ┌──────▼──────┐ ┌▼──────────┐ ┌▼────────────┐
              │ AUTH SERVICE │ │  INVENTORY  │ │  ORDERS   │ │  REPORTING  │
              │              │ │  SERVICE    │ │  SERVICE  │ │  SERVICE    │
              │ - Register   │ │             │ │           │ │             │
              │ - Login      │ │ - Products  │ │ - Create  │ │ - Dashboard │
              │ - JWT issue  │ │ - Stock     │ │   order   │ │ - Search    │
              │ - Validate   │ │ - Warehouses│ │ - Status  │ │ - Analytics │
              │ - Roles      │ │ - Alerts    │ │ - Saga    │ │             │
              └──────┬───────┘ └──────┬──────┘ └─────┬─────┘ └──────┬──────┘
                     │                │               │              │
              ┌──────▼───────┐ ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
              │  PostgreSQL  │ │ PostgreSQL  │ │PostgreSQL │ │Elasticsearch│
              │  (auth_db)   │ │(inventory_db│ │(orders_db)│ │+ PostgreSQL │
              └──────────────┘ └─────────────┘ └───────────┘ └─────────────┘

                        ┌─────────────────────────────────────────┐
                        │           EVENT BUS (Kafka)              │
                        │                                          │
                        │  Topics:                                 │
                        │  • order.placed                          │
                        │  • stock.updated                         │
                        │  • stock.low-alert                       │
                        │  • order.confirmed                       │
                        │  • order.cancelled                       │
                        └──────────────────────────────────────────┘
                               ▲              ▲
                               │ publish      │ consume
                        ┌──────┴──────┐ ┌─────┴──────┐
                        │   ORDERS    │ │ INVENTORY  │
                        │  SERVICE    │ │  SERVICE   │
                        └─────────────┘ └────────────┘
```

---

## Event Flow – Order Placement (Saga Pattern)

```
User
 │
 ▼
API Gateway ──► Orders Service
                    │
                    │ 1. Create order (status: PENDING)
                    │ 2. Publish → order.placed
                    │
                    ▼
              Kafka (order.placed)
                    │
                    ▼
            Inventory Service
                    │
                    │ 3. Check stock
                    │
                    ├── Stock OK  ──► Deduct stock
                    │                    │
                    │                    ▼
                    │              Publish → stock.updated
                    │                    │
                    │                    ▼
                    │              Orders Service
                    │                    │
                    │                    ▼
                    │              Update order → CONFIRMED
                    │
                    └── Stock LOW ──► Publish → order.cancelled
                                          │
                                          ▼
                                    Orders Service
                                          │
                                          ▼
                                    Update order → FAILED
                                    (compensating transaction)
```

---

## Sync vs Async Communication

| From | To | Protocol | When |
|---|---|---|---|
| Client | API Gateway | HTTPS | Every request |
| API Gateway | Auth Service | HTTP | Token validation |
| API Gateway | Inventory Service | HTTP | Product CRUD, stock reads |
| API Gateway | Orders Service | HTTP | Order creation, status check |
| API Gateway | Reporting Service | HTTP | Dashboard, search queries |
| Orders Service | Kafka | Async | Order placed |
| Inventory Service | Kafka | Async | Stock updated, low-stock alert |
| Reporting Service | Kafka | Async (consume) | Index updates for search |

---

## Data Ownership

```
auth_db (PostgreSQL)
  └── users (id, email, password_hash, role, created_at)
  └── refresh_tokens (id, user_id, token, expires_at)

inventory_db (PostgreSQL)
  └── products (id, name, sku, description, price, category)
  └── stock (id, product_id, warehouse_id, quantity, reserved)
  └── warehouses (id, name, location)
  └── stock_alerts (id, product_id, threshold, triggered_at)

orders_db (PostgreSQL)
  └── orders (id, user_id, status, total, created_at)
  └── order_items (id, order_id, product_id, quantity, price)
  └── saga_log (id, order_id, step, status, payload)

elasticsearch (reporting)
  └── products index (for search + faceted filters)
  └── orders index (for analytics)
```

---

## Redis Usage

| Use Case | Key Pattern | TTL |
|---|---|---|
| JWT blacklist | `blacklist:{token_jti}` | Token expiry |
| Rate limiting | `ratelimit:{ip}:{route}` | 1 minute |
| Session cache | `session:{user_id}` | 15 minutes |
| Stock cache | `stock:{product_id}` | 30 seconds |

---

## Folder Structure

```
month2/
├── services/
│   ├── auth-service/
│   ├── inventory-service/
│   ├── orders-service/
│   ├── reporting-service/
│   └── api-gateway/
├── shared/
│   ├── types/          # shared TypeScript interfaces
│   └── events/         # Kafka event schemas
├── docs/
│   ├── architecture/   # this file
│   └── openapi/        # API specs per service
└── infra/
    ├── docker/         # docker-compose files
    └── k8s/            # kubernetes manifests
```
