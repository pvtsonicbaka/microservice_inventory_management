# Kafka Event Schemas

All events follow this envelope:

```json
{
  "eventId": "uuid-v4",
  "eventType": "topic.name",
  "timestamp": "2026-03-01T12:00:00.000Z",
  "version": "1.0",
  "correlationId": "uuid-v4",
  "payload": { ... }
}
```

---

## Topics

### `order.placed`
Published by: **orders-service**  
Consumed by: **inventory-service**, **reporting-service**

```json
{
  "orderId": "uuid",
  "userId": "uuid",
  "total": 199.99,
  "items": [
    { "productId": "uuid", "quantity": 2 }
  ]
}
```

---

### `stock.updated`
Published by: **inventory-service**  
Consumed by: **orders-service**

```json
{
  "orderId": "uuid",
  "status": "SUCCESS"
}
```

---

### `order.confirmed`
Published by: **orders-service**  
Consumed by: **inventory-service**, **reporting-service**

```json
{
  "orderId": "uuid",
  "items": [
    { "productId": "uuid", "quantity": 2 }
  ]
}
```

---

### `order.cancelled`
Published by: **inventory-service** (insufficient stock) or **orders-service** (user cancel)  
Consumed by: **inventory-service** (release reservation), **orders-service** (mark FAILED), **reporting-service**

```json
{
  "orderId": "uuid",
  "reason": "insufficient_stock | user_cancelled",
  "items": [
    { "productId": "uuid", "quantity": 2 }
  ]
}
```

> **Note:** inventory-service ignores `order.cancelled` events where `reason === "insufficient_stock"` to avoid double-releasing reservations.

---

### `stock.low-alert`
Published by: **inventory-service**  
Consumed by: **reporting-service**

```json
{
  "productId": "uuid",
  "threshold": 5,
  "currentStock": 3
}
```

Deduplication: at most one alert per product per hour (enforced at DB level via `StockAlert` index on `(productId, triggeredAt)`).

---

### `product.created`
Published by: **inventory-service**  
Consumed by: **reporting-service**

```json
{
  "product": {
    "id": "uuid",
    "name": "MacBook Pro",
    "sku": "MBP-14-M3",
    "price": 1999.99,
    "category": "Electronics",
    "description": "...",
    "createdAt": "2026-03-01T12:00:00.000Z"
  }
}
```

---

### `product.updated`
Published by: **inventory-service**  
Consumed by: **reporting-service**

Same payload as `product.created`.

---

### `product.deleted`
Published by: **inventory-service**  
Consumed by: **reporting-service**

```json
{
  "productId": "uuid"
}
```

---

## Saga Flow

```
orders-service  →  order.placed
inventory-service  →  stock.updated  (success path)
orders-service  →  order.confirmed
inventory-service  (deducts stock on order.confirmed)

inventory-service  →  order.cancelled  (failure path, reason: insufficient_stock)
orders-service  (marks order FAILED on order.cancelled)
```
