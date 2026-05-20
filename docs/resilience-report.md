# Week 3 Resilience Report
**Project:** Microservices Inventory Management System  
**Date:** May 2026  
**Author:** LogicVeda Internship — Month 2

---

## Overview

This report documents all resilience patterns implemented during Week 3 (Days 15–21) of the project. The system is designed to handle partial failures gracefully, ensuring that a failure in one service does not cascade to bring down the entire platform.

---

## Resilience Patterns Implemented

### 1. Timeouts (Day 15)

All inter-service HTTP calls enforce strict timeouts to prevent resource exhaustion from slow upstream services.

| Call | Timeout | Location |
|------|---------|----------|
| Gateway → upstream services | 10,000ms | `api-gateway/src/index.ts` |
| Auth middleware → auth-service | 5,000ms | `*/middleware/auth.ts` |
| Health checks | 3,000ms | `api-gateway/src/index.ts` |

**Behavior on timeout:** Gateway returns `504 Gateway Timeout` with correlation ID.

---

### 2. Retries with Exponential Backoff (Day 15)

Kafka producers and consumers are configured with retry logic and exponential backoff to handle transient broker failures.

```typescript
const kafka = new Kafka({
  brokers: [process.env.KAFKA_BROKER],
  retry: {
    retries: 10,
    initialRetryTime: 300,  // 300ms initial delay
    factor: 2,              // doubles each retry: 300, 600, 1200...
  },
});
```

**Max wait time:** ~5 minutes total across 10 retries before giving up.

---

### 3. Graceful Degradation (Day 15)

Services degrade gracefully when dependencies are unavailable:

- **Elasticsearch down:** Search returns `{ data: [], total: 0, warning: "Search index unavailable" }` — no 500 errors
- **Kafka down at startup:** Reporting service starts without Kafka, logs a warning, continues serving HTTP requests
- **Inventory service down:** Gateway returns `503 Service Unavailable` — other services (auth, orders) continue working

---

### 4. Saga Pattern with Compensating Transactions (Day 11, verified Day 20)

The order placement flow uses the Saga pattern to maintain data consistency across services without distributed transactions.

```
POST /orders
    │
    ▼
Orders Service → publishes order.placed (Kafka)
    │
    ▼
Inventory Service → reserves stock
    ├── SUCCESS → publishes stock.updated
    │       └── Orders Service → CONFIRMED
    └── FAILURE → publishes order.cancelled (compensating transaction)
            └── Orders Service → FAILED
```

**Tested scenarios:**
- ✅ Happy path: order CONFIRMED, stock deducted
- ✅ Insufficient stock: order FAILED, no stock change
- ✅ User cancellation: stock reservation released

---

### 5. Circuit Breaker Pattern (Day 15)

The API Gateway implements per-upstream circuit breakers that open after repeated failures, preventing cascading load on degraded services.

**States:**
- `CLOSED` — normal operation
- `OPEN` — failing fast, requests rejected immediately with 503
- `HALF_OPEN` — testing recovery with limited requests

**Configuration:**
- Failure threshold: 5 consecutive failures
- Recovery timeout: 30 seconds
- Success threshold to close: 2 consecutive successes

---

### 6. Correlation ID Tracking (Day 19)

Every request is assigned a unique `x-correlation-id` header at the gateway. This ID is:
- Propagated to all downstream service calls
- Embedded in all Kafka event envelopes
- Included in all structured log entries
- Returned in error responses for debugging

**Example log entry:**
```json
{
  "timestamp": "2026-05-12T14:30:00.000Z",
  "level": "info",
  "service": "inventory-service",
  "msg": "Processing Kafka event: order.placed",
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "topic": "order.placed",
  "eventId": "uuid-here"
}
```

---

### 7. Structured JSON Logging (Day 19)

All services emit structured JSON logs with consistent fields:

```json
{
  "timestamp": "ISO8601",
  "level": "info|warn|error|debug",
  "service": "service-name",
  "msg": "human readable message",
  "correlationId": "uuid",
  "status": 200,
  "durationMs": 45
}
```

This format is compatible with ELK Stack (Elasticsearch + Logstash + Kibana) and Grafana Loki for log aggregation.

---

### 8. Graceful Shutdown (Day 19)

All services handle `SIGTERM` and `SIGINT` signals for zero-downtime deployments:

1. Stop accepting new connections
2. Disconnect Kafka consumers/producers cleanly
3. Close HTTP server
4. Exit with code 0

This ensures no in-flight messages are lost during rolling deployments in Kubernetes.

---

### 9. Body Size Limits (Day 15)

All services enforce a `10kb` limit on JSON request bodies to prevent DoS attacks via large payloads:

```typescript
app.use(express.json({ limit: "10kb" }));
```

Returns `413 Payload Too Large` for oversized requests.

---

### 10. Rate Limiting (Day 15)

The API Gateway enforces rate limiting at the edge:

- **Window:** 60 seconds
- **Max requests:** 100 per IP
- **Response on limit:** `429 Too Many Requests`

---

## Chaos Test Results (Day 20)

Tests run against live Docker Compose environment:

| Test | Scenario | Expected | Result |
|------|----------|----------|--------|
| 1 | Baseline health check | All services up | ✅ Pass |
| 2 | Invalid JWT token | 401 Unauthorized | ✅ Pass |
| 3 | Missing auth header | 401 Unauthorized | ✅ Pass |
| 4 | 105 rapid requests | 429 after 100 | ✅ Pass |
| 5 | Kill inventory service | 503 from gateway | ✅ Pass |
| 6 | Orders isolated from inventory failure | 200 on /orders | ✅ Pass |
| 7 | Inventory service recovery | 200 after restart | ✅ Pass |
| 8 | Kill orders service | 503 from gateway | ✅ Pass |
| 9 | Products isolated from orders failure | 200 on /products | ✅ Pass |
| 10 | Correlation ID propagation | Header echoed back | ✅ Pass |

**Run chaos tests:**
```bash
bash docs/chaos-test.sh
```

---

## Non-Functional Requirements Status

| Requirement | Target | Status |
|-------------|--------|--------|
| Throughput | ≥ 1,000 req/min per service | ✅ Achievable (Express + Node.js) |
| Resilience | Circuit breaking, retries, timeouts | ✅ Implemented |
| Observability | Structured logs + correlation IDs | ✅ Implemented |
| Data consistency | Eventual via sagas | ✅ Implemented |
| Graceful degradation | Partial failures handled | ✅ Implemented |
| Zero-downtime shutdown | SIGTERM handling | ✅ Implemented |

---

## Architecture Resilience Summary

```
                    ┌─────────────────────────────────┐
                    │         API GATEWAY              │
                    │  • Rate limiting (100 req/min)   │
                    │  • Circuit breakers per service  │
                    │  • 10s timeout on all proxies    │
                    │  • Correlation ID generation     │
                    │  • CORS + body size limits       │
                    └──────────────┬──────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼──────┐  ┌──────────▼──────┐  ┌────────▼────────┐
    │  AUTH SERVICE  │  │ INVENTORY SVC   │  │  ORDERS SVC     │
    │  • JWT 15m TTL │  │ • Atomic stock  │  │ • Saga pattern  │
    │  • Refresh 7d  │  │ • Kafka retry   │  │ • Kafka retry   │
    │  • Graceful    │  │ • Graceful      │  │ • Graceful      │
    │    shutdown    │  │   shutdown      │  │   shutdown      │
    └────────────────┘  └─────────────────┘  └─────────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │         KAFKA EVENT BUS          │
                    │  • At-least-once delivery        │
                    │  • Exponential backoff retry     │
                    │  • Correlation ID in envelopes   │
                    │  • Consumer crash → restart      │
                    └─────────────────────────────────┘
```

---

*Report generated as part of LogicVeda Web Development Domain — Month 2 Capstone*
