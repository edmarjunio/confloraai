#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-conflora-ai}"
REGION="${REGION:-southamerica-east1}"
QUEUE="${QUEUE:-conflora-jobs}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-conflora-api-sa}"
RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  cloudtasks.googleapis.com \
  aiplatform.googleapis.com \
  secretmanager.googleapis.com \
  sheets.googleapis.com

if ! gcloud firestore databases describe --database="(default)" >/dev/null 2>&1; then
  gcloud firestore databases create \
    --database="(default)" \
    --location="$REGION" \
    --edition=standard \
    --type=firestore-native \
    --delete-protection
fi

if ! gcloud tasks queues describe "$QUEUE" --location="$REGION" >/dev/null 2>&1; then
  gcloud tasks queues create "$QUEUE" \
    --location="$REGION" \
    --log-sampling-ratio=1.0
fi

if ! gcloud iam service-accounts describe "$RUNTIME_SA" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$RUNTIME_SA_NAME" \
    --display-name="Conflora AI Runtime"
fi

for ROLE in roles/datastore.user roles/cloudtasks.enqueuer roles/aiplatform.user; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$RUNTIME_SA" \
    --role="$ROLE" \
    --quiet >/dev/null
done

echo
echo "Infraestrutura base pronta."
echo "Conta de serviço da aplicação: $RUNTIME_SA"
echo "Compartilhe a planilha Google Sheets com esse e-mail como Leitor."
