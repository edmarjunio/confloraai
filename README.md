# Conflora AI 2.1

Agente de atendimento e vendas da Conflora para WhatsApp, usando:

- WhatsApp Cloud API (Meta)
- Gemini via Vertex AI
- Google Sheets como catálogo oficial
- Firestore para memória, pedidos e deduplicação
- Cloud Tasks para processamento assíncrono, follow-up e encaminhamento de comprovantes
- Cloud Run para produção

## Arquitetura

```text
WhatsApp / Meta
      |
      v
POST /webhook
      |
      | verifica assinatura X-Hub-Signature-256
      | enfileira e responde 200 rapidamente
      v
Cloud Tasks
      |
      v
/tasks/processar-mensagem
      |
      +--> Firestore: histórico / deduplicação / pedidos
      +--> Google Sheets: catálogo e preços
      +--> Gemini: conversa e decisões
      +--> WhatsApp Cloud API: resposta ao cliente

Pedido confirmado
      |
      +--> Cloud Tasks --> notificação da venda para o responsável
      +--> PIX --> cliente envia foto/PDF --> encaminhamento do comprovante

Pedido aguardando confirmação
      |
      +--> Cloud Tasks +1h --> follow-up único, se o cliente não respondeu
```

## Estrutura

```text
src/
  ai/                 # Gemini e ferramentas do agente
  catalog/            # acesso/pesquisa do catálogo no Sheets
  config/             # configuração centralizada
  database/           # persistência Firestore
  http/               # Express, webhook e rotas
  integrations/       # WhatsApp e Cloud Tasks
  orders/             # regras de pedido e confirmação
  security/           # validação de assinatura Meta
  services/           # orquestração do atendimento
  shared/             # utilitários e logger
scripts/
  setup-local.ps1
  bootstrap-gcp.sh
  create-secrets.sh
  deploy.sh
test/
```

## Princípios aplicados

- responsabilidade única por módulo;
- nomes que expressam intenção;
- funções pequenas e focadas;
- configuração fora do código;
- ausência de tokens/chaves no repositório;
- validação de configuração no startup;
- catálogo e preço revalidados no backend;
- deduplicação de mensagens e comprovantes;
- webhook com validação criptográfica;
- webhook rápido: processamento real em Cloud Tasks;
- logs estruturados sem expor segredos;
- endpoint `/chat` somente em desenvolvimento;
- testes das regras críticas de confirmação;
- `package-lock.json` deve ser versionado após `npm install`.

# 1. Instalação local no Windows

Abra o PowerShell no projeto:

```powershell
cd C:\Users\Junin\confloraai
```

Confirme:

```powershell
node --version
npm --version
```

Use Node 20 ou mais recente.

Instale as dependências:

```powershell
npm install
```

Isso também cria/atualiza `package-lock.json`. Versione esse arquivo.

Crie seu arquivo de desenvolvimento:

```powershell
Copy-Item .env.example .env
```

Preencha inicialmente apenas:

```dotenv
NODE_ENV=development
PORT=8080
GCP_PROJECT_ID=conflora-ai
GCP_REGION=southamerica-east1
GEMINI_LOCATION=global
GEMINI_MODEL=gemini-3.7-flash
SPREADSHEET_ID=1p9gVQkuZkVagi4gyP4Tp8fdItHm6W-wkT2osxTstQVU
SHEET_NAME=PRODUTOS
SHEETS_CACHE_SECONDS=60
```

Não versionar `.env`.

# 2. Google Cloud CLI no Windows

Instale o Google Cloud CLI se necessário e autentique:

```powershell
gcloud auth login
gcloud config set project conflora-ai
gcloud auth application-default login
gcloud auth application-default set-quota-project conflora-ai
```

As Application Default Credentials são usadas localmente pelo Firestore, Google Sheets e Vertex AI.

# 3. Infraestrutura Google Cloud

No Cloud Shell, a partir da raiz do projeto:

```bash
bash scripts/bootstrap-gcp.sh
```

O script:

- ativa APIs;
- cria Firestore `(default)` se necessário;
- cria a fila `conflora-jobs` se necessário;
- cria a conta `conflora-api-sa@conflora-ai.iam.gserviceaccount.com`;
- concede apenas os papéis de runtime necessários.

Depois compartilhe a planilha Google Sheets com:

```text
conflora-api-sa@conflora-ai.iam.gserviceaccount.com
```

como **Leitor**.

# 4. Testes locais

No PowerShell:

```powershell
npm run check
npm test
npm run dev
```

Em outro terminal:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:8080/chat" `
  -ContentType "application/json" `
  -Body (@{
    telefone = "5564000000001"
    nome = "Cliente Teste"
    mensagem = "Quero uma palmeira"
  } | ConvertTo-Json)
```

Continue com o mesmo telefone para testar memória:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:8080/chat" `
  -ContentType "application/json" `
  -Body (@{
    telefone = "5564000000001"
    nome = "Cliente Teste"
    mensagem = "Vou plantar direto no jardim"
  } | ConvertTo-Json)
```

Teste também algo direto:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:8080/chat" `
  -ContentType "application/json" `
  -Body (@{
    telefone = "5564000000002"
    nome = "Cliente Teste 2"
    mensagem = "Quanto custa a Palmeira Azul?"
  } | ConvertTo-Json)
```

# 5. Git

Na branch `feature/conflora-v2`:

```powershell
git status
git add .
git status
git diff --cached
git commit -m "Refatora Conflora AI com arquitetura modular e segurança"
git push -u origin feature/conflora-v2
```

Confirme que `.env`, `node_modules`, tokens ou arquivos JSON de credenciais NÃO aparecem.

Depois de validar localmente:

```powershell
git checkout main
git merge feature/conflora-v2
git push origin main
```

# 6. WhatsApp Cloud API

Para produção você precisa de:

- Business Portfolio da Meta;
- WhatsApp Business Account (WABA);
- número comercial conectado;
- Phone Number ID;
- versão atual da Graph API mostrada pela Meta;
- token de System User/permanente com as permissões necessárias;
- App Secret do aplicativo Meta.

Se o número da Conflora já é usado no **WhatsApp Business App** e você quer continuar usando o app no celular, use o fluxo oficial de **Coexistence/Embedded Signup** disponível para sua conta. Não remova nem migre o número do aplicativo antes de confirmar esse fluxo.

# 7. Segredos

No Cloud Shell:

```bash
bash scripts/create-secrets.sh
```

O script pede, sem exibir na tela:

- token permanente da Cloud API;
- App Secret da Meta.

E cria:

- `whatsapp-token`
- `whatsapp-verify-token`
- `meta-app-secret`
- `conflora-task-secret`
- `conflora-admin-secret`

Nunca cole esses valores em Git, código ou README.

# 8. Templates da Meta

Crie/aprove estes templates em `pt_BR`:

```text
nova_venda_conflora
comprovante_pix_imagem
comprovante_pix_documento
```

O segundo deve usar cabeçalho de imagem; o terceiro, cabeçalho de documento.

# 9. Deploy 24/7 no Cloud Run

O serviço usado atualmente é:

```text
conflora-api
```

URL:

```text
https://conflora-api-1073181815328.southamerica-east1.run.app
```

No Cloud Shell, defina os valores **sem colocá-los no código**:

```bash
export PROJECT_ID="conflora-ai"
export REGION="southamerica-east1"
export SPREADSHEET_ID="1p9gVQkuZkVagi4gyP4Tp8fdItHm6W-wkT2osxTstQVU"
export SERVICE_URL="https://conflora-api-1073181815328.southamerica-east1.run.app"
export WHATSAPP_GRAPH_VERSION="VERSAO_EXIBIDA_PELA_META"
export WHATSAPP_PHONE_NUMBER_ID="SEU_PHONE_NUMBER_ID"
export OWNER_WHATSAPP_NUMBER="55DDDNUMERO"
export PIX_KEY="SUA_CHAVE_PIX"
export PIX_TITULAR="SEU_TITULAR_PIX"
```

Depois:

```bash
bash scripts/deploy.sh
```

O deploy usa `--min 1`, mantendo uma instância quente do Cloud Run. Isso reduz cold starts e mantém capacidade pronta para receber webhooks, mas gera custo mesmo sem tráfego e a infraestrutura ainda pode reiniciar a instância quando necessário.

# 10. Webhook da Meta

Callback URL:

```text
https://conflora-api-1073181815328.southamerica-east1.run.app/webhook
```

Obtenha o verify token:

```bash
gcloud secrets versions access latest --secret=whatsapp-verify-token
```

Use esse valor somente na configuração do webhook da Meta.

Assine o campo/evento de mensagens da WABA.

O POST do webhook é validado com `X-Hub-Signature-256` usando o App Secret antes de aceitar mensagens.

# 11. Teste real

Do seu WhatsApp pessoal, envie uma mensagem para o número comercial conectado à Cloud API:

```text
Quero uma palmeira
```

Fluxo esperado:

```text
Meta -> /webhook -> Cloud Tasks -> Firestore -> Gemini + Sheets -> WhatsApp
```

Use logs para depuração:

```bash
gcloud run services logs read conflora-api \
  --region=southamerica-east1 \
  --limit=100
```

# 12. Teste do follow-up sem esperar uma hora

Temporariamente:

```bash
gcloud run services update conflora-api \
  --region=southamerica-east1 \
  --update-env-vars=FOLLOWUP_SECONDS=60
```

Leve um pedido até o resumo/solicitação de confirmação e não responda.

Depois volte para 1 hora:

```bash
gcloud run services update conflora-api \
  --region=southamerica-east1 \
  --update-env-vars=FOLLOWUP_SECONDS=3600
```

# 13. Fluxo de trabalho depois da implantação

Windows / VS Code:

```powershell
git checkout -b feature/minha-alteracao
# edite
npm run check
npm test
git add .
git commit -m "Descrição objetiva"
git push -u origin feature/minha-alteracao
```

Após merge na `main`, no Cloud Shell:

```bash
cd ~/conflora-ai
git pull origin main
bash scripts/deploy.sh
```

Depois que o fluxo estiver estável, o próximo passo recomendado é CI/CD para fazer o deploy automático da `main`.
