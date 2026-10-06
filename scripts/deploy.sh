#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-conflora-ai}"
REGION="${REGION:-southamerica-east1}"
SERVICE_NAME="conflora-api"
SERVICE_ACCOUNT="conflora-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo ">>> Iniciando deploy do Conflora AI no Cloud Run..."

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --service-account="${SERVICE_ACCOUNT}" \
  --min-instances=1 \
  --max-instances=10 \
  --cpu=1 \
  --memory=512Mi \
  --set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION},SPREADSHEET_ID=${SPREADSHEET_ID},SHEET_NAME=PRODUTOS,SHEETS_CACHE_SECONDS=60,SERVICE_URL=${SERVICE_URL},WHATSAPP_GRAPH_VERSION=${WHATSAPP_GRAPH_VERSION},WHATSAPP_PHONE_NUMBER_ID=${WHATSAPP_PHONE_NUMBER_ID},OWNER_WHATSAPP_NUMBER=${OWNER_WHATSAPP_NUMBER},PIX_KEY=${PIX_KEY},PIX_TITULAR=${PIX_TITULAR}" \
  --set-secrets="WHATSAPP_TOKEN=whatsapp-token:latest,WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest,META_APP_SECRET=meta-app-secret:latest,TASK_SECRET=conflora-task-secret:latest,ADMIN_SECRET=conflora-admin-secret:latest"

echo ">>> Deploy finalizado com sucesso no Cloud Run!"
