#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-conflora-ai}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-conflora-api-sa}"
RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID" >/dev/null

put_secret() {
  local name="$1"
  local value="$2"

  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf "%s" "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  else
    printf "%s" "$value" | gcloud secrets create "$name" \
      --replication-policy=automatic \
      --data-file=- >/dev/null
  fi

  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:$RUNTIME_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
}

read -rsp "Token permanente do WhatsApp Cloud API: " WHATSAPP_TOKEN_VALUE
echo
read -rsp "App Secret do app Meta: " META_APP_SECRET_VALUE
echo

VERIFY_TOKEN_VALUE="$(openssl rand -hex 24)"
TASK_SECRET_VALUE="$(openssl rand -hex 32)"
ADMIN_SECRET_VALUE="$(openssl rand -hex 32)"

put_secret "whatsapp-token" "$WHATSAPP_TOKEN_VALUE"
put_secret "whatsapp-verify-token" "$VERIFY_TOKEN_VALUE"
put_secret "meta-app-secret" "$META_APP_SECRET_VALUE"
put_secret "conflora-task-secret" "$TASK_SECRET_VALUE"
put_secret "conflora-admin-secret" "$ADMIN_SECRET_VALUE"

unset WHATSAPP_TOKEN_VALUE META_APP_SECRET_VALUE TASK_SECRET_VALUE ADMIN_SECRET_VALUE

echo
echo "Segredos criados/atualizados."
echo "Para configurar o webhook da Meta, obtenha o verify token com:"
echo "gcloud secrets versions access latest --secret=whatsapp-verify-token"
