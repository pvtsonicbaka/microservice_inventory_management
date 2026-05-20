#!/bin/bash
# ─────────────────────────────────────────────────────────────
# InvenFlow — Kubernetes Deploy Script
# Applies all manifests in dependency order
#
# Prerequisites:
#   - kubectl configured and pointing at your cluster
#   - metrics-server installed (required for HPA):
#       kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
#   - nginx ingress controller installed:
#       kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml
#   - Docker images built and pushed to your registry
#   - Update image names in each *-service.yaml before running
#
# Usage:
#   bash infra/k8s/deploy.sh              # deploy everything
#   bash infra/k8s/deploy.sh --dry-run    # preview without applying
#   bash infra/k8s/deploy.sh --teardown   # delete everything
# ─────────────────────────────────────────────────────────────

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=""
TEARDOWN=0

for arg in "$@"; do
  [ "$arg" = "--dry-run" ]  && DRY_RUN="--dry-run=client"
  [ "$arg" = "--teardown" ] && TEARDOWN=1
done

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

step()  { echo -e "${BLUE}▶ $1${NC}"; }
done_() { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${RED}⚠️  $1${NC}"; }

# ── Teardown ──────────────────────────────────────────────────
if [ "$TEARDOWN" = "1" ]; then
  warn "Deleting all InvenFlow resources from namespace invenflow..."
  kubectl delete namespace invenflow --ignore-not-found
  echo -e "${GREEN}✅ Teardown complete${NC}"
  exit 0
fi

step "Creating namespace..."
kubectl apply -f "$DIR/namespace.yaml" $DRY_RUN
done_ "Namespace: invenflow"

step "Applying secrets and config..."
kubectl apply -f "$DIR/secrets.yaml" $DRY_RUN
kubectl apply -f "$DIR/configmap.yaml" $DRY_RUN
done_ "Secrets + ConfigMap"

step "Deploying infrastructure (databases, cache, messaging)..."
kubectl apply -f "$DIR/postgres.yaml" $DRY_RUN
kubectl apply -f "$DIR/redis.yaml" $DRY_RUN
kubectl apply -f "$DIR/kafka.yaml" $DRY_RUN
kubectl apply -f "$DIR/elasticsearch.yaml" $DRY_RUN
done_ "Infrastructure"

if [ -z "$DRY_RUN" ]; then
  step "Waiting for infrastructure to be ready..."
  echo "  Waiting for auth-db..."
  kubectl rollout status deployment/auth-db -n invenflow --timeout=120s
  echo "  Waiting for inventory-db..."
  kubectl rollout status deployment/inventory-db -n invenflow --timeout=120s
  echo "  Waiting for orders-db..."
  kubectl rollout status deployment/orders-db -n invenflow --timeout=120s
  echo "  Waiting for redis..."
  kubectl rollout status deployment/redis -n invenflow --timeout=60s
  echo "  Waiting for kafka..."
  kubectl rollout status deployment/kafka -n invenflow --timeout=180s
  done_ "Infrastructure ready"
fi

step "Deploying microservices..."
kubectl apply -f "$DIR/auth-service.yaml" $DRY_RUN
kubectl apply -f "$DIR/inventory-service.yaml" $DRY_RUN
kubectl apply -f "$DIR/orders-service.yaml" $DRY_RUN
kubectl apply -f "$DIR/reporting-service.yaml" $DRY_RUN
kubectl apply -f "$DIR/api-gateway.yaml" $DRY_RUN
kubectl apply -f "$DIR/admin-dashboard.yaml" $DRY_RUN
done_ "Microservices"

step "Applying Ingress..."
kubectl apply -f "$DIR/ingress.yaml" $DRY_RUN
done_ "Ingress"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         🚀 InvenFlow deployed to Kubernetes!         ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Check status:                                       ║"
echo "║  kubectl get pods -n invenflow                       ║"
echo "║  kubectl get hpa -n invenflow                        ║"
echo "║  kubectl get ingress -n invenflow                    ║"
echo "╚══════════════════════════════════════════════════════╝"
