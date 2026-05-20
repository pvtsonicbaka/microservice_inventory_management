# Tech Stack

## Build System

**Turborepo** (`turbo@^2`) monorepo with npm workspaces. Each service builds independently; Turbo handles task orchestration and caching.

## Language & Runtime

- **TypeScript 5.5+** across all services
- **Node.js** runtime
- `tsx` for development (watch mode) and running tests directly without a separate compile step

## Frameworks & Libraries

| Category | Library | Version |
|----------|---------|---------|
| HTTP server | `express` | ^4.19 |
| ORM | `prisma` + `@prisma/client` | ^5.14 |
| Database | PostgreSQL 16 | per-service DB |
| Message broker | `kafkajs` | ^2.2 |
| Cache / blacklist | `redis` | ^4.6 |
| Auth | `jsonwebtoken`, `bcryptjs` | ^9, ^2.4 |
| Validation | `zod` | ^3.23 |
| HTTP client | `axios` | ^1.7 |
| ID generation | `uuid` | ^10 |
| Rate limiting | `express-rate-limit` | (api-gateway only) |
| Search | Elasticsearch | (reporting-service) |

## Common Commands

Run from the **workspace root** unless noted otherwise.

```bash
# Development (all services, watch mode)
npm run dev

# Build all services
npm run build

# Run all tests
npm run test

# Lint all services
npm run lint
```

Run from a **specific service directory**:

```bash
# Watch mode for a single service
npm run dev

# Compile TypeScript
npm run build

# Run tests (integration — requires running dependencies)
npm run test

# Start compiled output
npm run start

# Prisma migrations
npx prisma migrate dev
npx prisma generate
```

## Infrastructure

- **Docker Compose** (`infra/docker/docker-compose.yml`) spins up all services + dependencies
- **Kafka** (Confluent Platform 7.6) with Zookeeper — auto topic creation enabled
- **Redis 7** — used for JWT blacklisting, rate limiting, session cache, stock cache
- **Kubernetes** manifests in `infra/k8s/` (in progress)

### Exposed Ports (Docker Compose)

| Service | Host Port | Internal Port |
|---------|-----------|---------------|
| api-gateway | 4000 | 3000 |
| auth-service | 4001 | 3001 |
| inventory-service | 4002 | 3002 |
| orders-service | 4003 | 3003 |
| Redis | 6380 | 6379 |
| Kafka | 9093 | 9092 |

## Testing Approach

Tests are **integration tests** that run against live services (not unit tests with mocks). They use Node's built-in `node:test` runner with `node:assert`.

- Test files live in `src/tests/*.test.ts` within each service
- Run via `tsx --test src/tests/*.test.ts`
- Tests target a running service via `AUTH_URL`, `INVENTORY_URL`, etc. env vars (default: `localhost:400x`)
- Tests are stateful and sequential — they share tokens/IDs across `describe` blocks using module-level variables
