#!/bin/bash
set -e

TOKEN=$(curl -s -X POST http://localhost:4001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get admin token — is auth-service running?"
  exit 1
fi

echo "✅ Got admin token"
export ADMIN_TOKEN="$TOKEN"
export REPORTING_URL="http://localhost:4004"
export GATEWAY_URL="http://localhost:4000"
export AUTH_URL="http://localhost:4001"

npx tsx --test src/tests/reporting.test.ts
