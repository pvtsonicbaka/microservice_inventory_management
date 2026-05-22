#!/bin/bash
# One-command setup: start all services + push schemas + create admin
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/infra/docker/docker-compose.yml"

echo "🐳 Starting all services..."
sudo docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
sudo docker compose -f "$COMPOSE_FILE" up -d --build

echo "⏳ Waiting for databases to be healthy (45s)..."
sleep 45

echo "📦 Pushing database schemas..."

# Auth schema
sudo docker exec docker-auth-service-1 npx prisma db push --skip-generate 2>/dev/null \
  && echo "  ✅ auth schema pushed" \
  || echo "  ⚠️  auth schema push via service failed (may already exist)"

# Inventory schema — push directly via DB container as it may crash before push
sudo docker exec docker-inventory-db-1 psql -U postgres -d inventory_db -c "
CREATE TABLE IF NOT EXISTS \"Warehouse\" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS \"Product\" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category TEXT,
  \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS \"Stock\" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  \"productId\" TEXT NOT NULL REFERENCES \"Product\"(id) ON DELETE CASCADE,
  \"warehouseId\" TEXT NOT NULL REFERENCES \"Warehouse\"(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(\"productId\", \"warehouseId\")
);
CREATE TABLE IF NOT EXISTS \"StockAlert\" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  \"productId\" TEXT NOT NULL REFERENCES \"Product\"(id) ON DELETE CASCADE,
  threshold INTEGER NOT NULL,
  \"currentStock\" INTEGER NOT NULL DEFAULT 0,
  \"triggeredAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS \"StockAlert_productId_triggeredAt_idx\" ON \"StockAlert\"(\"productId\", \"triggeredAt\");
" > /dev/null 2>&1 && echo "  ✅ inventory schema pushed"

# Orders schema
sudo docker exec docker-orders-service-1 npx prisma db push --skip-generate 2>/dev/null \
  && echo "  ✅ orders schema pushed" \
  || echo "  ⚠️  orders schema push via service failed (may already exist)"

echo "🔄 Restarting services to pick up schemas..."
sudo docker start docker-inventory-service-1 2>/dev/null || true
sudo docker start docker-orders-service-1 2>/dev/null || true
sudo docker start docker-reporting-service-1 2>/dev/null || true
sleep 10

echo "👤 Creating admin account..."
RESULT=$(curl -s -X POST http://localhost:4001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@invenflow.com","password":"Admin@123","name":"Admin User"}')

USER_ID=$(echo "$RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$USER_ID" ]; then
  sudo docker exec docker-auth-db-1 psql -U postgres -d auth_db \
    -c "UPDATE \"User\" SET role='admin' WHERE email='admin@invenflow.com';" > /dev/null
  echo "✅ Admin created: admin@invenflow.com / Admin@123"
else
  echo "⚠️  Admin may already exist — promoting..."
  sudo docker exec docker-auth-db-1 psql -U postgres -d auth_db \
    -c "UPDATE \"User\" SET role='admin' WHERE email='admin@invenflow.com';" > /dev/null 2>&1 || true
fi

echo ""
echo "🌱 Seeding demo data (warehouses, products, users)..."
bash "$SCRIPT_DIR/scripts/seed.sh"

echo ""
echo "🚀 All done! Open your browser:"
echo "   Dashboard:  http://localhost:5173"
echo ""
echo "   Demo credentials:"
echo "   👑 admin@invenflow.com   / Admin@123"
echo "   💼 manager@invenflow.com / Manager@123"
echo "   👁  viewer@invenflow.com  / Viewer@123"
echo ""
echo "   Gateway:    http://localhost:4000"
echo "   Auth:       http://localhost:4001"
echo "   Inventory:  http://localhost:4002"
echo "   Orders:     http://localhost:4003"
echo "   Reporting:  http://localhost:4004"
