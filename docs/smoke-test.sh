#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Smoke Test — Quick sanity check after docker compose up
# ─────────────────────────────────────────────────────────────

BASE="http://localhost:4000"
AUTH="http://localhost:4001"
PASS=0
FAIL=0
TS=$(date +%s)

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

check() {
  local name="$1" status="$2" expected="$3"
  if [ "$status" -eq "$expected" ]; then
    echo -e "${GREEN}✅ $name ($status)${NC}"
    PASS=$((PASS+1))
  else
    echo -e "${RED}❌ $name (got $status, expected $expected)${NC}"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "🔍 Running smoke tests against $BASE ..."
echo ""

# ── Health ────────────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
check "Gateway health" "$STATUS" 200

HEALTH=$(curl -s "$BASE/health")
for SVC in auth inventory orders reporting; do
  SVC_STATUS=$(echo "$HEALTH" | grep -o "\"$SVC\":\"[^\"]*\"" | cut -d'"' -f4)
  if [ "$SVC_STATUS" = "up" ]; then
    echo -e "${GREEN}✅ $SVC service: up${NC}"
    PASS=$((PASS+1))
  else
    echo -e "${RED}❌ $SVC service: $SVC_STATUS${NC}"
    FAIL=$((FAIL+1))
  fi
done

# ── Auth ──────────────────────────────────────────────────────
echo ""
echo "── Auth ──"

# Register
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"smoke_$TS@test.com\",\"password\":\"password123\",\"name\":\"Smoke Test\"}")
check "Register new user" "$STATUS" 201

# Duplicate register → 409
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"smoke_$TS@test.com\",\"password\":\"password123\",\"name\":\"Dup\"}")
check "Duplicate register → 409" "$STATUS" 409

# Bad email → 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"notanemail","password":"password123","name":"Bad"}')
check "Invalid email → 400" "$STATUS" 400

# Login
RESPONSE=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"smoke_$TS@test.com\",\"password\":\"password123\"}")
TOKEN=$(echo "$RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
check "Login" "$([ -n "$TOKEN" ] && echo 200 || echo 0)" 200

# Wrong password → 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"smoke_$TS@test.com\",\"password\":\"wrongpass\"}")
check "Wrong password → 401" "$STATUS" 401

# Validate token
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$AUTH/auth/validate" \
  -H "Authorization: Bearer $TOKEN")
check "Validate token" "$STATUS" 200

# Invalid token → 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$AUTH/auth/validate" \
  -H "Authorization: Bearer bad.token.here")
check "Invalid token → 401" "$STATUS" 401

# ── Products ──────────────────────────────────────────────────
echo ""
echo "── Products ──"

# No token → 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/products")
check "No token → 401" "$STATUS" 401

# With token → 200
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/products" \
  -H "Authorization: Bearer $TOKEN")
check "List products (auth)" "$STATUS" 200

# Viewer cannot create → 403
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test","sku":"TST-001","price":9.99}')
check "Viewer create product → 403" "$STATUS" 403

# Non-existent product → 404
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/products/00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer $TOKEN")
check "Non-existent product → 404" "$STATUS" 404

# ── Warehouses ────────────────────────────────────────────────
echo ""
echo "── Warehouses ──"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/warehouses" \
  -H "Authorization: Bearer $TOKEN")
check "List warehouses (auth)" "$STATUS" 200

# ── Orders ────────────────────────────────────────────────────
echo ""
echo "── Orders ──"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/orders" \
  -H "Authorization: Bearer $TOKEN")
check "List orders (auth)" "$STATUS" 200

# No token → 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/orders")
check "Orders no token → 401" "$STATUS" 401

# Bad order body → 400
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"items":[]}')
check "Empty items → 400" "$STATUS" 400

# ── Search ────────────────────────────────────────────────────
echo ""
echo "── Search ──"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/search/products" \
  -H "Authorization: Bearer $TOKEN")
check "Search products (auth)" "$STATUS" 200

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/search/products")
check "Search no token → 401" "$STATUS" 401

# ── Logout ────────────────────────────────────────────────────
echo ""
echo "── Logout ──"

REFRESH=$(echo "$RESPONSE" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/logout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"refreshToken\":\"$REFRESH\"}")
check "Logout → 204" "$STATUS" 204

# ── Results ───────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════"
echo "Results: ✅ $PASS passed  ❌ $FAIL failed"
[ $FAIL -eq 0 ] && echo -e "${GREEN}🎉 All smoke tests passed!${NC}" \
  || echo -e "${RED}⚠️  Some tests failed — check output above${NC}"
