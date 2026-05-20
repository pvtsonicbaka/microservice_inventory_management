# Project Structure

## Monorepo Layout

```
/
├── services/               # Independent microservices (npm workspaces)
│   ├── api-gateway/        # Entry point: routing, JWT validation, rate limiting
│   ├── auth-service/       # Users, roles, JWT issuance
│   ├── inventory-service/  # Products, stock, warehouses, low-stock alerts
│   ├── orders-service/     # Orders, saga orchestration
│   └── reporting-service/  # Analytics, Elasticsearch search (in progress)
├── shared/
│   ├── events/             # Kafka event schema documentation (kafka-events.md)
│   └── types/              # Shared TypeScript interfaces (in progress)
├── docs/
│   ├── architecture/       # System architecture diagrams and decisions
│   └── openapi/            # Per-service OpenAPI specs (one YAML per service)
├── infra/
│   ├── docker/             # docker-compose.yml for local dev
│   └── k8s/                # Kubernetes manifests (in progress)
├── package.json            # Root workspace config
└── turbo.json              # Turborepo task pipeline
```

## Per-Service Layout

Every service follows the same internal structure:

```
services/<name>/
├── src/
│   ├── index.ts            # Express app setup and server entry point
│   ├── routes/             # Route handlers (one file per resource)
│   ├── middleware/         # auth.ts (authenticate + requireRole)
│   ├── lib/                # Shared utilities: prisma.ts, kafka.ts, jwt.ts
│   └── tests/              # Integration tests: <resource>.test.ts
├── prisma/
│   └── schema.prisma       # Prisma schema for this service's DB
├── Dockerfile
├── .env.example
├── package.json
└── tsconfig.json
```

## Conventions

### Service Entry Point (`src/index.ts`)
- Creates Express app, registers `express.json()`, mounts routers, adds `/health` endpoint
- Health endpoint returns `{ status: "ok", service: "<name>" }`
- Port read from `process.env.PORT` with a numeric default

### Route Files (`src/routes/`)
- One file per resource (e.g., `auth.ts`, `products.ts`, `orders.ts`)
- Use `Router()` from express, export as default
- Validate all request bodies with **Zod** schemas defined at the top of the file
- Return `res.status(400).json({ error: parsed.error.flatten() })` on validation failure
- Use standard HTTP status codes: 200/201 success, 400 bad request, 401 unauthorized, 403 forbidden, 404 not found, 409 conflict

### Authentication Middleware (`src/middleware/auth.ts`)
- `authenticate` — validates Bearer token; downstream services call `GET /auth/validate` via axios; api-gateway verifies JWT locally
- `requireRole(...roles)` — middleware factory for role-based access control
- Attaches `req.user: { sub, email, role }` on success

### Prisma (`src/lib/prisma.ts`)
- Exports a singleton `PrismaClient` instance
- Each service has its own isolated database — never share or cross-query another service's DB

### Kafka (`src/lib/kafka.ts`)
- Exports `producer`, `consumer`, and `connectKafka()` 
- `connectKafka()` is called at startup; handles all topic subscriptions and `eachMessage` routing
- Events follow the envelope: `{ eventId, eventType, timestamp, version, payload }`
- Use `publishEvent(topic, payload)` helper to send events — it wraps the envelope automatically
- Consumer group ID matches the service name (e.g., `"inventory-service"`)

### Environment Variables
- Each service has a `.env.example` documenting required vars
- Key vars: `PORT`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `AUTH_SERVICE_URL`, `KAFKA_BROKER`
- Never hardcode secrets; always read from `process.env`

### OpenAPI Specs
- One YAML file per service in `docs/openapi/`
- Keep in sync when adding or modifying endpoints
