#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-conflora-ai}"

echo ">>> Configuração segura de segredos no Google Secret Manager..."

create_or_update_secret() {
  local SECRET_NAME="$1"
  local SECRET_VAL="$2"

  if ! gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud secrets create "${SECRET_NAME}" --replication-policy="automatic" --project="${PROJECT_ID}"
  fi

  echo -n "${SECRET_VAL}" | gcloud secrets versions add "${SECRET_NAME}" --data-file=- --project="${PROJECT_ID}"
  echo "Segredo [${SECRET_NAME}] atualizado."
}

read -r -s -p "Token Permanente do WhatsApp Cloud API: " WHATSAPP_TOKEN
echo ""
read -r -s -p "Meta App Secret: " META_APP_SECRET
echo ""

WHATSAPP_VERIFY_TOKEN=$(openssl rand -hex 16)
TASK_SECRET=$(openssl rand -hex 32)
ADMIN_SECRET=$(openssl rand -hex 32)

create_or_update_secret "whatsapp-token" "${WHATSAPP_TOKEN}"
create_or_update_secret "meta-app-secret" "${META_APP_SECRET}"
create_or_update_secret "whatsapp-verify-token" "${WHATSAPP_VERIFY_TOKEN}"
create_or_update_secret "conflora-task-secret" "${TASK_SECRET}"
create_or_update_secret "conflora-admin-secret" "${ADMIN_SECRET}"

echo ">>> Todos os segredos foram criados/atualizados com sucesso no Secret Manager!"
