# ClinIQ Lite - Production Deployment Checklist

## Target: 50 Concurrent Users on Azure Container Apps

---

## Pre-Deployment Checklist

### 1. GitHub Secrets ✅

| Secret | Status | Notes |
|--------|--------|-------|
| `AZURE_CLIENT_ID` | ✅ Set | OIDC authentication |
| `AZURE_TENANT_ID` | ✅ Set | OIDC authentication |
| `AZURE_SUBSCRIPTION_ID` | ✅ Set | OIDC authentication |
| `ACR_NAME` | ✅ Set | Container registry name |
| `DATABASE_URL` | ✅ Set | PostgreSQL connection (with PgBouncer) |
| `DIRECT_URL` | ✅ Set | Direct DB connection (for migrations) |
| `JWT_SECRET` | ✅ Set | **Verify it's 64+ chars** |
| `CORS_ORIGIN` | ✅ Set | Must match web app URL |
| `NEXT_PUBLIC_API_BASE_URL` | ✅ Set | Must match API URL |

### 2. Dockerfiles ✅

- [x] Multi-stage builds for smaller images
- [x] Non-root user for web app (security)
- [x] Production NODE_ENV set
- [x] Prisma client generated in build

### 3. Database ✅

- [x] Prisma schema with proper indexes
- [x] PgBouncer connection pooling configured
- [x] Audit logging tables exist

### 4. Security ✅

- [x] Helmet security headers enabled
- [x] CORS properly configured
- [x] Rate limiting on auth endpoints (5/min login, 3/min register)
- [x] Input validation (ValidationPipe with whitelist)
- [x] Password hashing (bcrypt)
- [x] JWT authentication
- [x] Audit logging for PHI access

### 5. Health Checks ✅

- [x] `/health` - Liveness probe (returns 200)
- [x] `/ready` - Readiness probe (checks DB, returns 503 on failure)

---

## Azure Container Apps Configuration

### API Container App (`cliniq-lite-api`)

```bash
# Recommended settings for 50 users
az containerapp update \
  --name cliniq-lite-api \
  --resource-group cliniq-lite \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1Gi \
  --set-env-vars "NODE_ENV=production"
```

**Health Probes** (configure in Azure Portal or CLI):
```json
{
  "healthProbes": [
    {
      "type": "Liveness",
      "httpGet": {
        "path": "/health",
        "port": 4000
      },
      "initialDelaySeconds": 10,
      "periodSeconds": 30
    },
    {
      "type": "Readiness",
      "httpGet": {
        "path": "/ready",
        "port": 4000
      },
      "initialDelaySeconds": 5,
      "periodSeconds": 10
    }
  ]
}
```

### Web Container App (`cliniq-lite-web`)

```bash
# Recommended settings for 50 users
az containerapp update \
  --name cliniq-lite-web \
  --resource-group cliniq-lite \
  --min-replicas 1 \
  --max-replicas 2 \
  --cpu 0.25 \
  --memory 0.5Gi
```

---

## Deployment Steps

### Step 1: Verify Secrets

```bash
# List all secrets
gh secret list

# Verify JWT_SECRET is strong (run locally)
openssl rand -base64 48
# Update if current secret is weak
gh secret set JWT_SECRET
```

### Step 2: Run Database Migration

```bash
cd apps/api
npx prisma migrate deploy
```

### Step 3: Deploy via GitHub Actions

```bash
# Option A: GitHub UI
# Go to Actions → "Build & Deploy to Azure" → Run workflow

# Option B: CLI
gh workflow run deploy.yml
```

### Step 4: Configure Health Probes (Azure Portal)

1. Go to Azure Portal → cliniq-lite-api
2. Navigate to "Health probes" under Settings
3. Add Liveness probe: Path `/health`, Port `4000`
4. Add Readiness probe: Path `/ready`, Port `4000`

### Step 5: Verify Deployment

```bash
# Get URLs (replace with your actual URLs)
API_URL="https://cliniq-lite-api.westus2.azurecontainerapps.io"
WEB_URL="https://cliniq-lite-web.westus2.azurecontainerapps.io"

# Test health
curl $API_URL/health
curl $API_URL/ready

# Test web
open $WEB_URL
```

---

## Load Testing

### Install k6

```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux
sudo apt-get install k6
```

### Create Test User

Before load testing, create a test user in your system:
- Email: `loadtest@example.com`
- Password: `TestPassword123!`
- Role: CLINIC_MANAGER (for full API access)

### Run Load Tests

```bash
cd /path/to/ClinIQ-Lite

# Light load (10 users) - Quick verification
k6 run scripts/load-test.js

# 50 users simulation - Target capacity
k6 run --vus 50 --duration 5m scripts/load-test.js

# Stress test (100 users) - Find breaking point
k6 run --vus 100 --duration 10m scripts/load-test.js

# With custom URLs
API_URL=https://your-api.azurecontainerapps.io \
WEB_URL=https://your-web.azurecontainerapps.io \
TEST_EMAIL=loadtest@example.com \
TEST_PASSWORD=YourPassword123! \
k6 run scripts/load-test.js
```

### Expected Results for 50 Users

| Metric | Target | Critical |
|--------|--------|----------|
| p95 Response Time | < 500ms | < 2000ms |
| Error Rate | < 0.1% | < 1% |
| Throughput | > 100 req/s | > 50 req/s |
| Login Time (p95) | < 1000ms | < 3000ms |

---

## Monitoring & Alerts

### Azure Log Analytics

Your logs are configured to go to `cliniq-lite-logs-westus2`.

**Useful queries:**

```kusto
// Error rate by endpoint
ContainerAppConsoleLogs_CL
| where Log_s contains "error" or Log_s contains "Error"
| summarize count() by bin(TimeGenerated, 5m)
| render timechart

// Response time monitoring
ContainerAppConsoleLogs_CL
| where Log_s contains "ms"
| project TimeGenerated, Log_s
| order by TimeGenerated desc
```

### Recommended Alerts

1. **High Error Rate**: > 1% errors in 5 minutes
2. **High Response Time**: p95 > 2000ms
3. **Container Restart**: Any restart events
4. **Database Connection**: Ready endpoint returns 503

---

## Rollback Procedure

If deployment fails:

```bash
# List recent revisions
az containerapp revision list \
  --name cliniq-lite-api \
  --resource-group cliniq-lite \
  --output table

# Activate previous revision
az containerapp revision activate \
  --name cliniq-lite-api \
  --resource-group cliniq-lite \
  --revision <previous-revision-name>

# Route traffic to previous revision
az containerapp ingress traffic set \
  --name cliniq-lite-api \
  --resource-group cliniq-lite \
  --revision-weight <previous-revision-name>=100
```

---

## Post-Deployment Verification

- [ ] Web app loads correctly
- [ ] Login works
- [ ] Can view patients (as manager/staff)
- [ ] Can view/create appointments
- [ ] Queue functionality works
- [ ] Health checks return 200
- [ ] Audit logs are being written
- [ ] No errors in Log Analytics

---

## Cost Estimate (50 users)

| Resource | Monthly Cost |
|----------|--------------|
| Container Apps (API) | ~$15-30 |
| Container Apps (Web) | ~$10-20 |
| Container Registry | ~$5 |
| Log Analytics | ~$5-10 |
| Database (Supabase Free/Pro) | $0-25 |
| **Total** | **~$35-90/month** |

---

## Support

- GitHub Issues: https://github.com/aidev10328/ClinIQ-Lite/issues
- Documentation: [README.md](./README.md)
