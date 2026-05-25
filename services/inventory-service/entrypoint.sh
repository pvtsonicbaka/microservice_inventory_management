#!/bin/sh
set -e
echo "Running Prisma migrations..."
npx prisma db push --skip-generate
echo "Starting inventory-service..."
exec node dist/index.js
