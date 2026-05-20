#!/bin/bash
# ─────────────────────────────────────────────────────────────
# End-to-End Saga Flow Test
# Tests the full order → stock reservation → confirmation flow
# ─────────────────────────────────────────────────────────────

AUTH="http://localhost:4001"
INVENTORY="http://localhost:4002"
GATEWAY="http://localhost:4000"
PASS=0
FAIL=0
TS=$(date +%s)

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ $1${NC}"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}❌ $1${NC}"; FAIL=$((FAIL+1)); }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Poll for order status with timeout
wait_for_status() {
  local ORDER_ID="$1"
  local TOKEN="$2"
  local EXPECTED="$3"
  local MAX=20   # max attempts
  local i=0
  while [ $i -lt $MAX ]; do
    STATUS=$(curl -s "$GATEWAY/orders/$ORDER_ID/status" \
      -H "Authorization: Bearer $TOKEN" \
      | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    [ "$STATUS" = "$EXPECTED" ] && echo "$STATUS" && return 0
    sleep 1
    i=$((i+1))
  done
  echo "$STATUS"
  return 1
}

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         🚀 End-to-End Saga Flow Test                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Register user ─────────────────────────────────────
echo "── Step 1: Register ──"
REGISTER=$(curl -s -X POST "$AUTH/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"e2e_$TS@test.com\",\"password\":\"password123\",\"name\":\"E2E User\"}")
TOKEN=$(echo "$REGISTER" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
USER_ID=$(echo "$REGISTER" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  pass "Register user"
else
  fail "Register failed — $REGISTER"
  exit 1
fi

# ── Step 2: Promote to admin ──────────────────────────────────
echo ""
echo "── Step 2: Promote to admin ──"
sudo docker exec docker-auth-db-1 psql -U postgres -d auth_db \
  -c "UPDATE \"User\" SET role='admin' WHERE id='$USER_ID';" > /dev/null 2>&1

TOKEN=$(curl -s -X POST "$AUTH/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"e2e_$TS@test.com\",\"password\":\"password123\"}" \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  pass "Got admin token"
else
  fail "Failed to get admin token"
  exit 1
fi

# ── Step 3: Create warehouse ──────────────────────────────────
echo ""
echo "── Step 3: Warehouse ──"
WAREHOUSE=$(curl -s -X POST "$INVENTORY/warehouses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"E2E Warehouse","location":"Test City"}')
WAREHOUSE_ID=$(echo "$WAREHOUSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$WAREHOUSE_ID" ]; then
  pass "Create warehouse ($WAREHOUSE_ID)"
else
  fail "Create warehouse — $WAREHOUSE"
fi

# ── Step 4: Create product ────────────────────────────────────
echo ""
echo "── Step 4: Product ──"
PRODUCT=$(curl -s -X POST "$INVENTORY/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"E2E Laptop\",\"sku\":\"E2E-LAP-$TS\",\"price\":999.99,\"category\":\"Electronics\"}")
PRODUCT_ID=$(echo "$PRODUCT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PRODUCT_ID" ]; then
  pass "Create product ($PRODUCT_ID)"
else
  fail "Create product — $PRODUCT"
  exit 1
fi

# ── Step 5: Add stock ─────────────────────────────────────────
echo ""
echo "── Step 5: Stock ──"
STOCK=$(curl -s -X PATCH "$INVENTORY/products/$PRODUCT_ID/stock" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"quantity\":50,\"operation\":\"set\",\"warehouseId\":\"$WAREHOUSE_ID\"}")
STOCK_QTY=$(echo "$STOCK" | grep -o '"quantity":[0-9]*' | cut -d':' -f2)

if [ "$STOCK_QTY" = "50" ]; then
  pass "Set stock to 50"
else
  fail "Set stock failed — $STOCK"
fi

# ── Step 6: Place order ───────────────────────────────────────
echo ""
echo "── Step 6: Place Order ──"
ORDER=$(curl -s -X POST "$GATEWAY/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"items\":[{\"productId\":\"$PRODUCT_ID\",\"quantity\":2}]}")
ORDER_ID=$(echo "$ORDER" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
ORDER_STATUS=$(echo "$ORDER" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ORDER_ID" ] && [ "$ORDER_STATUS" = "PENDING" ]; then
  pass "Order placed — status: PENDING"
else
  fail "Place order failed — $ORDER"
  exit 1
fi

# ── Step 7: Wait for saga to confirm ─────────────────────────
echo ""
echo "── Step 7: Saga Confirmation (polling up to 20s) ──"
FINAL_STATUS=$(wait_for_status "$ORDER_ID" "$TOKEN" "CONFIRMED")

if [ "$FINAL_STATUS" = "CONFIRMED" ]; then
  pass "Order CONFIRMED via saga ✓"
else
  fail "Order status: $FINAL_STATUS (expected CONFIRMED)"
  info "Saga steps: $(curl -s "$GATEWAY/orders/$ORDER_ID/status" -H "Authorization: Bearer $TOKEN")"
fi

# ── Step 8: Verify stock deducted ────────────────────────────
echo ""
echo "── Step 8: Stock Deduction ──"
STOCK_RESP=$(curl -s "$INVENTORY/products/$PRODUCT_ID/stock" \
  -H "Authorization: Bearer $TOKEN")
NEW_QTY=$(echo "$STOCK_RESP" | grep -o '"quantity":[0-9]*' | head -1 | cut -d':' -f2)
NEW_RESERVED=$(echo "$STOCK_RESP" | grep -o '"reserved":[0-9]*' | head -1 | cut -d':' -f2)

if [ "$NEW_QTY" = "48" ]; then
  pass "Stock deducted correctly: 50 → 48 (ordered 2)"
else
  fail "Stock quantity: $NEW_QTY (expected 48) — reserved: $NEW_RESERVED"
fi

# ── Step 9: Validate token ────────────────────────────────────
echo ""
echo "── Step 9: Token Validation ──"
VALIDATE=$(curl -s -o /dev/null -w "%{http_code}" "$AUTH/auth/validate" \
  -H "Authorization: Bearer $TOKEN")
[ "$VALIDATE" = "200" ] && pass "Token validation works" || fail "Token validation returned $VALIDATE"

# ── Step 10: Cancel a new order ──────────────────────────────
echo ""
echo "── Step 10: Order Cancellation ──"
ORDER2=$(curl -s -X POST "$GATEWAY/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"items\":[{\"productId\":\"$PRODUCT_ID\",\"quantity\":1}]}")
ORDER2_ID=$(echo "$ORDER2" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ORDER2_ID" ]; then
  # Wait for it to be CONFIRMED first
  wait_for_status "$ORDER2_ID" "$TOKEN" "CONFIRMED" > /dev/null 2>&1
  CANCEL_STATUS=$(curl -s -X POST "$GATEWAY/orders/$ORDER2_ID/cancel" \
    -H "Authorization: Bearer $TOKEN" \
    | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  [ "$CANCEL_STATUS" = "CANCELLED" ] && pass "Order cancelled successfully" || fail "Cancel returned: $CANCEL_STATUS"
else
  fail "Could not place order for cancellation test"
fi

# ── Step 11: Insufficient stock → FAILED ─────────────────────
echo ""
echo "── Step 11: Insufficient Stock → FAILED ──"
BIG_ORDER=$(curl -s -X POST "$GATEWAY/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"items\":[{\"productId\":\"$PRODUCT_ID\",\"quantity\":99999}]}")
BIG_ORDER_ID=$(echo "$BIG_ORDER" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$BIG_ORDER_ID" ]; then
  BIG_STATUS=$(wait_for_status "$BIG_ORDER_ID" "$TOKEN" "FAILED")
  [ "$BIG_STATUS" = "FAILED" ] && pass "Insufficient stock → order FAILED (saga compensated)" || fail "Expected FAILED, got: $BIG_STATUS"
else
  fail "Could not place oversized order"
fi

# ── Step 12: Search products ──────────────────────────────────
echo ""
echo "── Step 12: Search ──"
SEARCH=$(curl -s "$GATEWAY/search/products?q=E2E" \
  -H "Authorization: Bearer $TOKEN")
DATA=$(echo "$SEARCH" | grep -o '"data":\[')
[ -n "$DATA" ] && pass "Search endpoint returns valid response" || fail "Search broken — $SEARCH"

# ── Results ───────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                    Results                           ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  ✅ Passed: %-3d                                      ║\n" $PASS
printf "║  ❌ Failed: %-3d                                      ║\n" $FAIL
echo "╚══════════════════════════════════════════════════════╝"
echo ""
[ $FAIL -eq 0 ] && echo -e "${GREEN}🎉 Full saga flow working!${NC}" || echo -e "${YELLOW}⚠️  Some steps failed. Review output above.${NC}"
