param(
    [Parameter(Mandatory = $true)][string]$FirebaseApiKey,
    [Parameter(Mandatory = $true)][string]$FirebaseAppId
)
. "$PSScriptRoot/dev-common.ps1"
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    # Testes são uma condição da publicação. Não executa npm test (placeholder antigo).
    & npm run test:pix
    if ($LASTEXITCODE -ne 0) { throw 'Testes Pix falharam; deploy interrompido.' }
    & npm run test:dev-isolation
    if ($LASTEXITCODE -ne 0) { throw 'Testes de isolamento falharam; deploy interrompido.' }

    $project = Get-DevGcloud -Arguments @('projects', 'describe', $DevProject)
    if ($FirebaseAppId -notlike "1:$($project.projectNumber):web:*") {
        throw 'FIREBASE_APP_ID deve pertencer ao projeto confloraai-dev.'
    }
    foreach ($name in @('conflora-admin-secret', 'conflora-task-secret')) {
        $version = Get-DevGcloud -Arguments @('secrets', 'versions', 'describe', 'latest', "--secret=$name")
        if ($version.state -ne 'ENABLED') { throw "Secret sem versão ativa: $name" }
    }
    # O bucket é inicializado pelo Firebase para preservar suporte às URLs de download.
    Invoke-DevGcloud -Arguments @('storage', 'buckets', 'describe', 'gs://confloraai-dev.firebasestorage.app') | Out-Null
    Invoke-DevGcloud -Arguments @('storage', 'buckets', 'add-iam-policy-binding', 'gs://confloraai-dev.firebasestorage.app',
        "--member=serviceAccount:$DevRuntimeAccount", '--role=roles/storage.objectUser') | Out-Null

    $vars = @{
        NODE_ENV = 'production'; APP_ENV = 'dev'; GCP_PROJECT_ID = $DevProject
        FIREBASE_PROJECT_ID = $DevProject; GCP_REGION = $DevRegion
        FIREBASE_AUTH_DOMAIN = 'confloraai-dev.firebaseapp.com'
        FIREBASE_STORAGE_BUCKET = 'confloraai-dev.firebasestorage.app'
        FIREBASE_API_KEY = $FirebaseApiKey; FIREBASE_APP_ID = $FirebaseAppId
        CLOUD_TASKS_QUEUE = 'conflora-jobs-dev'; SERVICE_URL = 'https://confloraai-dev.web.app'
        PIX_MODE = 'MANUAL'; WHATSAPP_AI_ENABLED = 'false'
        STORE_STOCK_CONTROL_ENABLED = 'true'
    }
    $envFile = Join-Path ([IO.Path]::GetTempPath()) ("conflora-dev-env-" + [guid]::NewGuid() + '.json')
    try {
        $vars | ConvertTo-Json | Set-Content -LiteralPath $envFile -Encoding utf8
        Invoke-DevGcloud -Arguments @('run', 'deploy', $DevProject, '--source=.', "--region=$DevRegion",
            "--service-account=$DevRuntimeAccount",
            "--build-service-account=projects/$DevProject/serviceAccounts/$DevBuildAccount",
            '--allow-unauthenticated', '--min-instances=0', '--max-instances=2', '--memory=512Mi',
            "--env-vars-file=$envFile",
            '--set-secrets=ADMIN_SECRET=conflora-admin-secret:latest,TASK_SECRET=conflora-task-secret:latest')
    } finally {
        if (Test-Path -LiteralPath $envFile) { Remove-Item -LiteralPath $envFile }
    }
    Invoke-DevFirebase -Arguments @('deploy', '--only', 'hosting,firestore:rules,storage', '--config', 'firebase.dev.json')
    $health = Invoke-RestMethod -Uri 'https://confloraai-dev.web.app/health'
    if ($health.projectId -ne $DevProject -or $health.environment -ne 'dev' -or $health.paymentProvider -ne 'MANUAL') {
        throw 'A URL publicada não corresponde ao ambiente dev com Pix real.'
    }
    Write-Host 'Dev publicado: https://confloraai-dev.web.app'
    Write-Host 'Webhook: https://confloraai-dev.web.app/webhooks/sicredi'
} finally { Pop-Location }
