#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-conflora-ai}"
REGION="${GCP_REGION:-southamerica-east1}"
SERVICE_ACCOUNT="conflora-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"
QUEUE_NAME="${CLOUD_TASKS_QUEUE:-conflora-jobs}"

echo ">>> Configurando projeto GCP: ${PROJECT_ID} na região ${REGION}..."

# 1. Ativar APIs necessárias
gcloud services enable \
  run.googleapis.com \
  cloudtasks.googleapis.com \
  firestore.googleapis.com \
  sheets.googleapis.com \
  aiplatform.googleapis.com \
  secretmanager.googleapis.com \
  --project="${PROJECT_ID}"

# 2. Criar fila do Cloud Tasks se não existir
if ! gcloud tasks queues describe "${QUEUE_NAME}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo ">>> Criando fila do Cloud Tasks: ${QUEUE_NAME}..."
  gcloud tasks queues create "${QUEUE_NAME}" \
    --location="${REGION}" \
    --project="${PROJECT_ID}"
else
  echo ">>> Fila do Cloud Tasks ${QUEUE_NAME} já existe."
fi

# 3. Criar Service Account se não existir
if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" --project="${PROJECT_ID}" &>/dev/null; then
  echo ">>> Criando conta de serviço: conflora-api-sa..."
  gcloud iam service-accounts create conflora-api-sa \
    --display-name="Conflora AI Service Account" \
    --project="${PROJECT_ID}"
fi

# 4. Conceder permissões de runtime mínimas necessárias
ROLES=(
  "roles/datastore.user"
  "roles/cloudtasks.enqueuer"
  "roles/aiplatform.user"
  "roles/secretmanager.secretAccessor"
)

for ROLE in "${ROLES[@]}"; do
  echo ">>> Vinculando papel ${ROLE}..."
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="${ROLE}" \
    --condition=None
done

echo ">>> Bootstrap concluído com sucesso!"
echo ">>> Não esqueça de compartilhar a planilha do Google Sheets com: ${SERVICE_ACCOUNT} (como Leitor)."
