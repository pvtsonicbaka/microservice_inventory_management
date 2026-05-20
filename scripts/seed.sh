#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Seed Script — Inserts demo data into the system
# Run after setup.sh or after docker compose up
# ─────────────────────────────────────────────────────────────

AUTH="http://localhost:4001"
INVENTORY="http://localhost:4002"
GATEWAY="http://localhost:4000"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         🌱 InvenFlow — Demo Data Seeder              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Create admin user ─────────────────────────────────
info "Creating admin account..."
REGISTER=$(curl -s -X POST $AUTH/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@invenflow.com","password":"Admin@123","name":"Admin User"}')
ADMIN_ID=$(echo $REGISTER | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ADMIN_ID" ]; then
  # Promote to admin
  sudo docker exec docker-auth-db-1 psql -U postgres -d auth_db \
    -c "UPDATE \"User\" SET role='admin' WHERE email='admin@invenflow.com';" > /dev/null 2>&1
  pass "Admin created: admin@invenflow.com / Admin@123"
else
  info "Admin may already exist, continuing..."
fi

# Get fresh admin token
TOKEN=$(curl -s -X POST $AUTH/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@invenflow.com","password":"Admin@123"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  # Try default admin
  TOKEN=$(curl -s -X POST $AUTH/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@test.com","password":"password123"}' \
    | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
  fail "Could not get admin token. Run setup.sh first."
  exit 1
fi
pass "Admin token obtained"

# ── Step 2: Create demo users ─────────────────────────────────
info "Creating demo users..."

# Manager
MGR=$(curl -s -X POST $AUTH/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@invenflow.com","password":"Manager@123","name":"Sarah Manager"}')
MGR_ID=$(echo $MGR | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$MGR_ID" ]; then
  sudo docker exec docker-auth-db-1 psql -U postgres -d auth_db \
    -c "UPDATE \"User\" SET role='manager' WHERE email='manager@invenflow.com';" > /dev/null 2>&1
  pass "Manager created: manager@invenflow.com / Manager@123"
fi

# Viewer
curl -s -X POST $AUTH/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"viewer@invenflow.com","password":"Viewer@123","name":"John Viewer"}' > /dev/null
pass "Viewer created: viewer@invenflow.com / Viewer@123"

# ── Step 3: Create warehouses ─────────────────────────────────
info "Creating warehouses..."

WH1=$(curl -s -X POST $INVENTORY/warehouses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Mumbai Central","location":"Mumbai, Maharashtra"}')
WH1_ID=$(echo $WH1 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$WH1_ID" ] && pass "Warehouse: Mumbai Central" || fail "Failed to create Mumbai warehouse"

WH2=$(curl -s -X POST $INVENTORY/warehouses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Delhi North Hub","location":"New Delhi, Delhi"}')
WH2_ID=$(echo $WH2 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$WH2_ID" ] && pass "Warehouse: Delhi North Hub" || fail "Failed to create Delhi warehouse"

WH3=$(curl -s -X POST $INVENTORY/warehouses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Bangalore Tech Park","location":"Bangalore, Karnataka"}')
WH3_ID=$(echo $WH3 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$WH3_ID" ] && pass "Warehouse: Bangalore Tech Park" || fail "Failed to create Bangalore warehouse"

# ── Step 4: Create products ───────────────────────────────────
info "Creating products..."

create_product() {
  local NAME="$1" SKU="$2" PRICE="$3" CATEGORY="$4" DESC="$5"
  curl -s -X POST $INVENTORY/products \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"name\":\"$NAME\",\"sku\":\"$SKU\",\"price\":$PRICE,\"category\":\"$CATEGORY\",\"description\":\"$DESC\"}" \
    | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4
}

set_stock() {
  local PRODUCT_ID="$1" WH_ID="$2" QTY="$3"
  curl -s -X PATCH $INVENTORY/products/$PRODUCT_ID/stock \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"quantity\":$QTY,\"operation\":\"set\",\"warehouseId\":\"$WH_ID\"}" > /dev/null
}

# Electronics
P1=$(create_product "MacBook Pro 14\" M3" "APPLE-MBP14-M3" 1999.99 "Electronics" "Apple MacBook Pro with M3 chip, 16GB RAM, 512GB SSD")
[ -n "$P1" ] && pass "Product: MacBook Pro" || fail "MacBook Pro"
[ -n "$P1" ] && [ -n "$WH1_ID" ] && set_stock $P1 $WH1_ID 25
[ -n "$P1" ] && [ -n "$WH2_ID" ] && set_stock $P1 $WH2_ID 15

P2=$(create_product "iPhone 15 Pro" "APPLE-IP15P-256" 1199.99 "Electronics" "Apple iPhone 15 Pro, 256GB, Titanium finish")
[ -n "$P2" ] && pass "Product: iPhone 15 Pro" || fail "iPhone 15 Pro"
[ -n "$P2" ] && [ -n "$WH1_ID" ] && set_stock $P2 $WH1_ID 50
[ -n "$P2" ] && [ -n "$WH3_ID" ] && set_stock $P2 $WH3_ID 30

P3=$(create_product "Samsung 4K OLED TV 55\"" "SAMSUNG-TV55-OLED" 1499.99 "Electronics" "Samsung 55-inch 4K OLED Smart TV with HDR")
[ -n "$P3" ] && pass "Product: Samsung TV" || fail "Samsung TV"
[ -n "$P3" ] && [ -n "$WH2_ID" ] && set_stock $P3 $WH2_ID 20

P4=$(create_product "Sony WH-1000XM5 Headphones" "SONY-WH1000XM5" 349.99 "Electronics" "Industry-leading noise cancelling wireless headphones")
[ -n "$P4" ] && pass "Product: Sony Headphones" || fail "Sony Headphones"
[ -n "$P4" ] && [ -n "$WH1_ID" ] && set_stock $P4 $WH1_ID 40
[ -n "$P4" ] && [ -n "$WH3_ID" ] && set_stock $P4 $WH3_ID 25

# Clothing
P5=$(create_product "Nike Air Max 270" "NIKE-AM270-BLK-10" 149.99 "Clothing" "Nike Air Max 270 running shoes, Black, Size 10")
[ -n "$P5" ] && pass "Product: Nike Air Max" || fail "Nike Air Max"
[ -n "$P5" ] && [ -n "$WH1_ID" ] && set_stock $P5 $WH1_ID 100
[ -n "$P5" ] && [ -n "$WH2_ID" ] && set_stock $P5 $WH2_ID 80

P6=$(create_product "Levi's 501 Original Jeans" "LEVIS-501-32x32" 79.99 "Clothing" "Classic straight fit jeans, 32x32, Dark wash")
[ -n "$P6" ] && pass "Product: Levi's Jeans" || fail "Levi's Jeans"
[ -n "$P6" ] && [ -n "$WH3_ID" ] && set_stock $P6 $WH3_ID 60

# Home & Kitchen
P7=$(create_product "Instant Pot Duo 7-in-1" "INSTPOT-DUO-6QT" 89.99 "Home & Kitchen" "7-in-1 electric pressure cooker, 6 quart")
[ -n "$P7" ] && pass "Product: Instant Pot" || fail "Instant Pot"
[ -n "$P7" ] && [ -n "$WH1_ID" ] && set_stock $P7 $WH1_ID 35
[ -n "$P7" ] && [ -n "$WH2_ID" ] && set_stock $P7 $WH2_ID 20

P8=$(create_product "Dyson V15 Detect Vacuum" "DYSON-V15-DETECT" 699.99 "Home & Kitchen" "Cordless vacuum with laser dust detection")
[ -n "$P8" ] && pass "Product: Dyson Vacuum" || fail "Dyson Vacuum"
[ -n "$P8" ] && [ -n "$WH3_ID" ] && set_stock $P8 $WH3_ID 15

# Books
P9=$(create_product "Clean Code by Robert Martin" "BOOK-CLEANCODE" 39.99 "Books" "A handbook of agile software craftsmanship")
[ -n "$P9" ] && pass "Product: Clean Code" || fail "Clean Code"
[ -n "$P9" ] && [ -n "$WH1_ID" ] && set_stock $P9 $WH1_ID 200

P10=$(create_product "Designing Data-Intensive Applications" "BOOK-DDIA" 49.99 "Books" "The big ideas behind reliable, scalable, and maintainable systems")
[ -n "$P10" ] && pass "Product: DDIA Book" || fail "DDIA Book"
[ -n "$P10" ] && [ -n "$WH2_ID" ] && set_stock $P10 $WH2_ID 150

# Low stock item (to trigger alert)
P11=$(create_product "Limited Edition Gaming Chair" "CHAIR-GAMING-LE" 299.99 "Furniture" "Limited edition ergonomic gaming chair with RGB lighting")
[ -n "$P11" ] && pass "Product: Gaming Chair (low stock)" || fail "Gaming Chair"
[ -n "$P11" ] && [ -n "$WH1_ID" ] && set_stock $P11 $WH1_ID 3  # Below threshold — triggers alert

# ── Step 5: Place sample orders ───────────────────────────────
info "Placing sample orders..."

if [ -n "$P1" ] && [ -n "$P4" ]; then
  ORDER1=$(curl -s -X POST $GATEWAY/orders \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"items\":[{\"productId\":\"$P1\",\"quantity\":1},{\"productId\":\"$P4\",\"quantity\":2}]}")
  O1_ID=$(echo $ORDER1 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  [ -n "$O1_ID" ] && pass "Sample order 1 placed (MacBook + Headphones)" || fail "Order 1 failed"
fi

sleep 5  # Wait for saga

if [ -n "$P5" ] && [ -n "$P9" ]; then
  ORDER2=$(curl -s -X POST $GATEWAY/orders \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"items\":[{\"productId\":\"$P5\",\"quantity\":2},{\"productId\":\"$P9\",\"quantity\":3}]}")
  O2_ID=$(echo $ORDER2 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  [ -n "$O2_ID" ] && pass "Sample order 2 placed (Shoes + Books)" || fail "Order 2 failed"
fi

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                  🎉 Seed Complete!                   ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Demo Accounts:                                      ║"
echo "║  👑 admin@invenflow.com    / Admin@123               ║"
echo "║  💼 manager@invenflow.com  / Manager@123             ║"
echo "║  👁  viewer@invenflow.com   / Viewer@123              ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Data Created:                                       ║"
echo "║  🏭 3 warehouses                                     ║"
echo "║  📦 11 products across 5 categories                  ║"
echo "║  📊 Stock set across warehouses                      ║"
echo "║  🛒 2 sample orders placed                           ║"
echo "║  ⚠️  1 low-stock alert triggered                     ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Dashboard: http://localhost:5173                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
