#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:4001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

echo "Token: ${TOKEN:0:40}..."
echo ""
echo "=== Direct validate ==="
curl -s http://localhost:4001/auth/validate -H "Authorization: Bearer $TOKEN"
echo ""
echo "=== Gateway /products ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:4000/products -H "Authorization: Bearer $TOKEN"
echo "=== Gateway /reporting/search/products ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:4000/reporting/search/products" -H "Authorization: Bearer $TOKEN"
echo "=== Gateway /search/products ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:4000/search/products" -H "Authorization: Bearer $TOKEN"
echo "=== Gateway /users ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:4000/users" -H "Authorization: Bearer $TOKEN"
echo "=== Gateway /auth/users ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:4000/auth/users" -H "Authorization: Bearer $TOKEN"
