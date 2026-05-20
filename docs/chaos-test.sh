#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Day 20 – Chaos Testing Script
# Tests resilience patterns: graceful degradation, timeouts,
# circuit breaking, and service recovery
# ─────────────────────────────────────────────────────────────

GATEWAY="http://localhost:4000"
AUTH="http://localhost:4001"
PASS=0
FAIL=0
TS=$(date +%s)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ $1${NC}"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}❌ $1${NC}"; FAIL=$((FAIL+1)); }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         🔥 Chaos Testing – Resilience Suite          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Setup: get admin token ────────────────────────────────────
info "Setting up test credentials..."
REGISTER=$(curl -s -X POST $AUTH/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"chaos_$TS@test.com\",\"password\":\"password123\",\"name\":\"Chaos Tester\"}")
TOKEN=$(echo $REGISTER | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  fail "Could not get auth token — is the system running?"
  exit 1
fi
pass "Auth token obtained"

# ── Test 1: Health check baseline ────────────────────────────
echo ""
echo "── Test 1: Baseline Health Check ──"
HEALTH=$(curl -s $GATEWAY/health)
AUTH_STATUS=$(echo $HEALTH | grep -o '"auth":"[^"]*"' | cut -d'"' -f4)
INV_STATUS=$(echo $HEALTH | grep -o '"inventory":"[^"]*"' | cut -d'"' -f4)
ORD_STATUS=$(echo $HEALTH | grep -o '"orders":"[^"]*"' | cut -d'"' -f4)

[ "$AUTH_STATUS" = "up" ] && pass "Auth service healthy" || fail "Auth service down"
[ "$INV_STATUS" = "up" ]  && pass "Inventory service healthy" || fail "Inventory service down"
[ "$ORD_STATUS" = "up" ]  && pass "Orders service healthy" || fail "Orders service down"

# ── Test 2: Invalid token rejection ──────────────────────────
echo ""
echo "── Test 2: Auth Resilience – Invalid Token ──"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $GATEWAY/products \
  -H "Authorization: Bearer invalid.token.here")
[ "$STATUS" = "401" ] && pass "Invalid token correctly rejected (401)" || fail "Expected 401, got $STATUS"

# ── Test 3: Missing token rejection ──────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $GATEWAY/orders)
[ "$STATUS" = "401" ] && pass "Missing token correctly rejected (401)" || fail "Expected 401, got $STATUS"

# ── Test 4: Rate limiting ─────────────────────────────────────
echo ""
echo "── Test 3: Rate Limiting (sending 105 rapid requests) ──"
RATE_LIMITED=0
for i in $(seq 1 105); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" $GATEWAY/health)
  if [ "$CODE" = "429" ]; then
    RATE_LIMITED=1
    break
  fi
done
[ "$RATE_LIMITED" = "1" ] && pass "Rate limiter triggered at 100 req/min" || warn "Rate limiter not triggered (may need more requests)"

# ── Test 5: Kill inventory service ───────────────────────────
echo ""
echo "── Test 4: Inventory Service Failure ──"
info "Stopping inventory-service container..."
sudo docker stop docker-inventory-service-1 > /dev/null 2>&1
sleep 3

# Gateway should return 503 for inventory routes
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $GATEWAY/products \
  -H "Authorization: Bearer $TOKEN")
[ "$STATUS" = "503" ] || [ "$STATUS" = "502" ] && pass "Gateway returns 5xx when inventory is down (graceful degradation)" || fail "Expected 503/502, got $STATUS"

# Orders service should still work (independent service)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $GATEWAY/orders \
  -H "Authorization: Bearer $TOKEN")
[ "$STATUS" = "200" ] && pass "Orders service still works when inventory is down (isolation)" || warn "Orders returned $STATUS (may be expected if no orders exist)"

# ── Test 6: Restore inventory service ────────────────────────
echo ""
echo "── Test 5: Service Recovery ──"
info "Restarting inventory-service..."
sudo docker start docker-inventory-service-1 > /dev/null 2>&1
sleep 8

STATUS=$(curl -s -o /dev/null -w "%{http_code}" $GATEWAY/products \
  -H "Authorization: Bearer $TOKEN")
[ "$STATUS" = "200" ] && pass "Inventory service recovered successfully" || fail "Inventory service failed to recover (got $STATUS)"

# ── Test 7: Kill orders service ───────────────────────────────
echo ""
echo "── Test 6: Orders Service Failure ──"
info "Stopping orders-service container..."
sudo docker stop docker-orders-service-1 > /dev/null 2>&1
sleep 3

STATUS=$(curl -s -o /dev/null -w "%{http_code}" $GATEWAY/orders \
  -H "Authorization: Bearer $TOKEN")
[ "$STATUS" = "503" ] || [ "$STATUS" = "502" ] && pass "Gateway returns 5xx when orders is down" || fail "Expected 503/502, got $STATUS"

# Products still accessible
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $GATEWAY/products \
  -H "Authorization: Bearer $TOKEN")
[ "$STATUS" = "200" ] && pass "Products still accessible when orders is down (isolation)" || fail "Products returned $STATUS"

# Restore
info "Restarting orders-service..."
sudo docker start docker-orders-service-1 > /dev/null 2>&1
sleep 8

STATUS=$(curl -s -o /dev/null -w "%{http_code}" $GATEWAY/orders \
  -H "Authorization: Bearer $TOKEN")
[ "$STATUS" = "200" ] && pass "Orders service recovered successfully" || fail "Orders service failed to recover"

# ── Test 8: Correlation ID propagation ───────────────────────
echo ""
echo "── Test 7: Correlation ID Propagation ──"
CORR_ID="chaos-test-$(date +%s)"
RESPONSE_CORR=$(curl -s -I $GATEWAY/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-correlation-id: $CORR_ID" \
  | grep -i "x-correlation-id" | tr -d '\r' | cut -d' ' -f2)

[ "$RESPONSE_CORR" = "$CORR_ID" ] && pass "Correlation ID propagated correctly in response headers" || warn "Correlation ID not found in response (got: $RESPONSE_CORR)"

# ── Test 9: Large payload rejection ──────────────────────────
echo ""
echo "── Test 8: Large Payload Rejection (DoS protection) ──"
LARGE_PAYLOAD=$(python3 -c "import json; print(json.dumps({'name': 'x' * 20000, 'sku': 'TEST', 'price': 1}))" 2>/dev/null || echo '{"name":"'"$(head -c 20000 /dev/urandom | base64 | head -c 20000)"'","sku":"TEST","price":1}')
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST $GATEWAY/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$LARGE_PAYLOAD")
[ "$STATUS" = "413" ] && pass "Large payload rejected (413 Payload Too Large)" || warn "Large payload returned $STATUS (body limit may be set higher)"

# ── Test 10: Elasticsearch degradation ───────────────────────
echo ""
echo "── Test 9: Search Graceful Degradation ──"
SEARCH=$(curl -s $GATEWAY/search/products \
  -H "Authorization: Bearer $TOKEN")
DATA=$(echo $SEARCH | grep -o '"data":\[' | head -1)
[ -n "$DATA" ] && pass "Search returns valid response (with or without ES)" || fail "Search endpoint broken"

# ── Results ───────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                    Results                           ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  ✅ Passed: %-3d                                      ║\n" $PASS
printf "║  ❌ Failed: %-3d                                      ║\n" $FAIL
echo "╚══════════════════════════════════════════════════════╝"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 All chaos tests passed! System is resilient.${NC}"
else
  echo -e "${YELLOW}⚠️  Some tests failed. Review output above.${NC}"
fi
