# Product Overview

This is a **microservices-based Inventory Management System** built for managing products, stock levels, warehouses, and orders across multiple services.

## Core Capabilities

- **User authentication** with role-based access control (admin, manager, viewer)
- **Product & inventory management** — CRUD for products, stock tracking per warehouse, low-stock alerts
- **Order processing** — order creation, status tracking, and saga-based distributed transaction handling
- **Reporting & search** — analytics dashboard and Elasticsearch-backed product/order search
- **API Gateway** — single entry point for all clients with JWT validation and rate limiting

## User Roles

| Role | Capabilities |
|------|-------------|
| `admin` | Full access including role management |
| `manager` | Product and stock management |
| `viewer` | Read-only access |

## Key Business Rules

- Stock is **reserved** (not immediately deducted) when an order is placed, preventing oversell
- Orders follow a **saga pattern**: `PENDING → CONFIRMED` on stock success, or `FAILED` with compensating transaction on insufficient stock
- Low-stock alerts fire when available stock drops to or below threshold (default: 5 units), with deduplication (max one alert per product per hour)
- JWT access tokens expire in 15 minutes; refresh tokens expire in 7 days
