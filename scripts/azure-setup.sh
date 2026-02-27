#!/bin/bash
# ClinIQ Lite - Azure Container Apps Setup Script
# Run this after initial deployment to configure health probes and scaling

set -e

# Configuration
RESOURCE_GROUP="cliniq-lite"
API_APP_NAME="cliniq-lite-api"
WEB_APP_NAME="cliniq-lite-web"

echo "🔧 ClinIQ Lite - Azure Production Setup"
echo "========================================"

# Check if logged in
if ! az account show &>/dev/null; then
    echo "❌ Not logged into Azure. Please run: az login"
    exit 1
fi

echo "✅ Azure login verified"

# Get current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo "📍 Subscription: $SUBSCRIPTION"

# ────────────────────────────────────────────────────────────
# Configure API Container App
# ────────────────────────────────────────────────────────────
echo ""
echo "🔧 Configuring API Container App..."

# Update scaling for 50 users
echo "   Setting scaling: min=1, max=3 replicas"
az containerapp update \
    --name $API_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --min-replicas 1 \
    --max-replicas 3 \
    --cpu 0.5 \
    --memory 1Gi \
    --output none

echo "   ✅ API scaling configured"

# Note: Health probes need to be configured via YAML or Portal
# Creating a YAML template for reference
cat > /tmp/api-health-probes.yaml << 'EOF'
# Apply via: az containerapp update --name cliniq-lite-api --resource-group cliniq-lite --yaml /tmp/api-health-probes.yaml
properties:
  template:
    containers:
      - name: cliniq-lite-api
        probes:
          - type: Liveness
            httpGet:
              path: /health
              port: 4000
            initialDelaySeconds: 10
            periodSeconds: 30
            failureThreshold: 3
          - type: Readiness
            httpGet:
              path: /ready
              port: 4000
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
EOF

echo "   📝 Health probe YAML created at /tmp/api-health-probes.yaml"
echo "   ℹ️  To apply health probes, use Azure Portal or:"
echo "      az containerapp update --name $API_APP_NAME --resource-group $RESOURCE_GROUP --yaml /tmp/api-health-probes.yaml"

# ────────────────────────────────────────────────────────────
# Configure Web Container App
# ────────────────────────────────────────────────────────────
echo ""
echo "🔧 Configuring Web Container App..."

# Update scaling for 50 users
echo "   Setting scaling: min=1, max=2 replicas"
az containerapp update \
    --name $WEB_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --min-replicas 1 \
    --max-replicas 2 \
    --cpu 0.25 \
    --memory 0.5Gi \
    --output none

echo "   ✅ Web scaling configured"

# ────────────────────────────────────────────────────────────
# Get URLs and verify
# ────────────────────────────────────────────────────────────
echo ""
echo "🔍 Retrieving deployment URLs..."

API_URL=$(az containerapp show --name $API_APP_NAME --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv)
WEB_URL=$(az containerapp show --name $WEB_APP_NAME --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv)

echo ""
echo "📋 Deployment URLs:"
echo "   API: https://$API_URL"
echo "   Web: https://$WEB_URL"

# ────────────────────────────────────────────────────────────
# Health check verification
# ────────────────────────────────────────────────────────────
echo ""
echo "🏥 Verifying health endpoints..."

# Check API health
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$API_URL/health" || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ /health endpoint: OK (HTTP $HTTP_STATUS)"
else
    echo "   ❌ /health endpoint: FAILED (HTTP $HTTP_STATUS)"
fi

# Check API readiness
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$API_URL/ready" || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ /ready endpoint: OK (HTTP $HTTP_STATUS)"
else
    echo "   ⚠️  /ready endpoint: Status $HTTP_STATUS (may indicate DB issue)"
fi

# Check Web app
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$WEB_URL" || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ Web app: OK (HTTP $HTTP_STATUS)"
else
    echo "   ❌ Web app: FAILED (HTTP $HTTP_STATUS)"
fi

# ────────────────────────────────────────────────────────────
# Summary
# ────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "🎉 Setup Complete!"
echo ""
echo "Next steps:"
echo "  1. Configure health probes in Azure Portal (Settings → Health probes)"
echo "  2. Create test user for load testing"
echo "  3. Run load test: k6 run scripts/load-test.js"
echo ""
echo "Environment variables for load testing:"
echo "  export API_URL=https://$API_URL"
echo "  export WEB_URL=https://$WEB_URL"
echo ""
