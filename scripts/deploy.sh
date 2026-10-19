#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-confloraai}"
REGION="${REGION:-southamerica-east1}"
SERVICE_NAME="${SERVICE_NAME:-confloraai}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-$(gcloud run services describe "$SERVICE_NAME" --project="$PROJECT_ID" --region="$REGION" --format='value(spec.template.spec.serviceAccountName)')}"
if [[ -z "$SERVICE_ACCOUNT" ]]; then
  echo "Informe SERVICE_ACCOUNT ou prepare a conta de execução antes de publicar." >&2
  exit 1
fi
PIX_MODE="${PIX_MODE:-MANUAL}"
SECRET_BINDINGS="WHATSAPP_TOKEN=whatsapp-token:latest,WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest,META_APP_SECRET=meta-app-secret:latest,TASK_SECRET=conflora-task-secret:latest,ADMIN_SECRET=conflora-admin-secret:latest"
if [[ "$PIX_MODE" == "SICREDI" ]]; then
  SECRET_BINDINGS+=",SICREDI_CLIENT_ID=sicredi-client-id:latest,SICREDI_CLIENT_SECRET=sicredi-client-secret:latest,SICREDI_CERT_PEM=sicredi-cert-pem:latest,SICREDI_KEY_PEM=sicredi-key-pem:latest,SICREDI_WEBHOOK_SECRET=sicredi-webhook-secret:latest"
fi

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
  --set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION},SERVICE_URL=${SERVICE_URL},WHATSAPP_GRAPH_VERSION=${WHATSAPP_GRAPH_VERSION},WHATSAPP_PHONE_NUMBER_ID=${WHATSAPP_PHONE_NUMBER_ID},OWNER_WHATSAPP_NUMBER=${OWNER_WHATSAPP_NUMBER},STORE_NOTIFICATION_PHONE=${STORE_NOTIFICATION_PHONE:-${OWNER_WHATSAPP_NUMBER}},PIX_MODE=${PIX_MODE:-MANUAL},PIX_KEY=${PIX_KEY},PIX_TITULAR=${PIX_TITULAR}" \
  --set-secrets="${SECRET_BINDINGS}"

echo ">>> Deploy finalizado com sucesso no Cloud Run!"
