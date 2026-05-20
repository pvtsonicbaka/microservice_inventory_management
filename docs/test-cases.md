# Test Cases — Inventory Management System

## How to Run

```bash
# 1. Start all services
docker compose -f infra/docker/docker-compose.yml up -d

# 2. Unit / integration tests (per service)
cd services/auth-service      && npm test
cd services/inventory-service && npm test
cd services/orders-service    && npm test

# 3. Smoke test (gateway up + basic auth flow)
bash docs/smoke-test.sh

# 4. Full end-to-end saga test
bash docs/e2e-saga-test.sh
```

For admin-only test cases, set these env vars before running:
```bash
export ADMIN_TOKEN="<jwt from e2e-saga-test.sh step 2>"
export TEST_PRODUCT_ID="<product id from e2e-saga-test.sh step 4>"
```

---

## Auth Service (`services/auth-service/src/tests/auth.test.ts`)

### POST /auth/register

| # | Test | Expected |
|---|------|----------|
| 1 | Valid registration | 201 + accessToken + refreshToken + role=viewer |
| 2 | Duplicate email | 409 |
| 3 | Invalid email format | 400 |
| 4 | Password shorter than 8 chars | 400 |
| 5 | Missing name field | 400 |
| 6 | Empty body | 400 |

### POST /auth/login

| # | Test | Expected |
|---|------|----------|
| 7 | Correct credentials | 200 + accessToken + refreshToken |
| 8 | Wrong password | 401 |
| 9 | Non-existent email | 401 |
| 10 | Missing password field | 400 |

### GET /auth/validate

| # | Test | Expected |
|---|------|----------|
| 11 | Valid access token | 200 + sub + email + role |
| 12 | Tampered token | 401 |
| 13 | No Authorization header | 401 |
| 14 | Malformed Bearer header (Token instead of Bearer) | 401 |

### POST /auth/refresh

| # | Test | Expected |
|---|------|----------|
| 15 | Valid refresh token | 200 + new accessToken |
| 16 | Invalid refresh token | 401 |
| 17 | Missing refresh token body | 400 |

### PATCH /auth/users/:id/role

| # | Test | Expected |
|---|------|----------|
| 18 | Non-admin tries to change role | 403 |
| 19 | No token | 401 |
| 20 | Invalid role value (e.g. "superuser") | 400 |
| 21 | Admin promotes user to manager | 200 + updated role |

### POST /auth/logout

| # | Test | Expected |
|---|------|----------|
| 22 | Logout with valid refresh token | 204 |
| 23 | Refresh token no longer works after logout | 401 |
| 24 | Logout with no body (idempotent) | 204 |

---

## Inventory Service (`services/inventory-service/src/tests/inventory.test.ts`)

### GET /products

| # | Test | Expected |
|---|------|----------|
| 25 | Authenticated request | 200 + { data[], total, page } |
| 26 | No token | 401 |
| 27 | Filter by category | 200 + all items match category |
| 28 | Limit query param | 200 + data.length ≤ limit |

### POST /products

| # | Test | Expected |
|---|------|----------|
| 29 | Viewer creates product | 403 |
| 30 | Admin — missing required fields | 400 |
| 31 | Admin — negative price | 400 |
| 32 | Admin — valid product | 201 + product with id |
| 33 | Admin — duplicate SKU | 409 |

### GET /products/:id

| # | Test | Expected |
|---|------|----------|
| 34 | Valid product id | 200 + product object |
| 35 | Non-existent id | 404 |

### PUT /products/:id

| # | Test | Expected |
|---|------|----------|
| 36 | Viewer updates product | 403 |
| 37 | Admin updates product | 200 + updated fields |
| 38 | Non-existent product | 404 |

### DELETE /products/:id

| # | Test | Expected |
|---|------|----------|
| 39 | Viewer deletes product | 403 |
| 40 | Admin deletes product | 204 |
| 41 | GET after deletion | 404 |

### Warehouses

| # | Test | Expected |
|---|------|----------|
| 42 | GET /warehouses | 200 + array |
| 43 | Viewer creates warehouse | 403 |
| 44 | Admin — missing location | 400 |
| 45 | Admin creates warehouse | 201 + warehouse with id |

### Stock — PATCH /products/:id/stock

| # | Test | Expected |
|---|------|----------|
| 46 | Viewer patches stock | 403 |
| 47 | Invalid operation value | 400 |
| 48 | Non-integer quantity | 400 |
| 49 | operation=set | 200 + quantity matches |
| 50 | operation=increment | 200 + quantity increased |
| 51 | operation=decrement | 200 + quantity decreased |
| 52 | Decrement exceeds available stock | 409 |

### Stock — GET /products/:id/stock

| # | Test | Expected |
|---|------|----------|
| 53 | Returns stock with available field | 200 + available = quantity - reserved |

### Stock Alerts — GET /stock/alerts

| # | Test | Expected |
|---|------|----------|
| 54 | Viewer accesses alerts | 403 |
| 55 | Admin accesses alerts | 200 + array |

---

## Orders Service (`services/orders-service/src/tests/orders.test.ts`)

### GET /orders

| # | Test | Expected |
|---|------|----------|
| 56 | Authenticated request | 200 + { data[], total, page } |
| 57 | No token | 401 |
| 58 | Filter by status | 200 + all items match status |
| 59 | Pagination params | 200 + data.length ≤ limit |

### POST /orders — Validation

| # | Test | Expected |
|---|------|----------|
| 60 | Empty items array | 400 |
| 61 | Invalid productId (not UUID) | 400 |
| 62 | quantity = 0 | 400 |
| 63 | Negative quantity | 400 |
| 64 | Missing items field | 400 |
| 65 | No token | 401 |

### POST /orders — Saga Flow

| # | Test | Expected |
|---|------|----------|
| 66 | Valid order with in-stock product | 202 + status=PENDING |
| 67 | Order transitions to CONFIRMED after Kafka saga | status=CONFIRMED + sagaSteps includes stock.updated |
| 68 | Order FAILED when quantity > available stock | status=FAILED after saga compensation |

### GET /orders/:id

| # | Test | Expected |
|---|------|----------|
| 69 | Non-existent order | 404 |
| 70 | Another user reads order | 403 |
| 71 | Owner reads own order | 200 + order with items |
| 72 | Admin reads any order | 200 |

### GET /orders/:id/status

| # | Test | Expected |
|---|------|----------|
| 73 | Returns status + saga steps with timestamps | 200 + { orderId, status, sagaSteps[] } |
| 74 | Non-existent order | 404 |

### POST /orders/:id/cancel

| # | Test | Expected |
|---|------|----------|
| 75 | Non-existent order | 404 |
| 76 | Another user cancels order | 403 |
| 77 | Owner cancels PENDING order | 200 + status=CANCELLED |
| 78 | Cancel already CANCELLED order | 409 |
| 79 | Cancel a FAILED order | 409 |

---

## Smoke Test (`docs/smoke-test.sh`)

Runs against the API Gateway (`localhost:4000`). Covers:

| # | Test | Expected |
|---|------|----------|
| S1 | GET /health | 200 |
| S2 | POST /auth/register | 201 |
| S3 | POST /auth/login + token extraction | token present |
| S4 | GET /products with token | 200 |
| S5 | GET /products without token | 401 |
| S6 | GET /orders with token | 200 |

---

## End-to-End Saga Test (`docs/e2e-saga-test.sh`)

Full saga flow from registration to stock deduction. Covers:

| # | Step | Expected |
|---|------|----------|
| E1 | Register user | token returned |
| E2 | Promote to admin via DB | admin token obtained |
| E3 | Create warehouse | warehouse id returned |
| E4 | Create product | product id returned |
| E5 | Set stock to 50 | quantity = 50 |
| E6 | Place order (qty 2) | order id returned, status PENDING |
| E7 | Wait for Kafka saga | status = CONFIRMED |
| E8 | Verify stock deducted | quantity = 48 |
| E9 | Cancel order | status = CANCELLED |
| E10 | Place order with qty 9999 | status = FAILED (saga compensated) |

---

## Coverage Summary

| Service | Unit Tests | Saga/E2E |
|---------|-----------|----------|
| Auth | 24 cases | E1, E2, S2, S3 |
| Inventory | 31 cases | E3–E5, E8, S4, S5 |
| Orders | 24 cases | E6–E10, S6 |
| **Total** | **79 cases** | **10 e2e steps** |
