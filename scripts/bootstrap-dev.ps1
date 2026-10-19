param(
    [Parameter(Mandatory = $true)][string]$BillingAccount,
    [string]$OrganizationId,
    [string]$FolderId
)
. "$PSScriptRoot/dev-common.ps1"
if ($OrganizationId -and $FolderId) { throw 'Informe OrganizationId ou FolderId, não ambos.' }
Get-Command gcloud -ErrorAction Stop | Out-Null
Get-Command firebase -ErrorAction Stop | Out-Null

# Nenhum comando altera o projeto padrão do gcloud ou o projeto confloraai.
$projects = @(Get-DevGcloud -Arguments @('projects', 'list', '--filter=projectId=confloraai-dev'))
if ($projects.Count -eq 0) {
    $create = @('projects', 'create', $DevProject, '--name=Conflora AI Dev', '--labels=environment=dev')
    if ($OrganizationId) { $create += "--organization=$OrganizationId" }
    if ($FolderId) { $create += "--folder=$FolderId" }
    Invoke-DevGcloud -Arguments $create
}
Invoke-DevGcloud -Arguments @('billing', 'projects', 'link', $DevProject, "--billing-account=$BillingAccount")
Invoke-DevGcloud -Arguments @('services', 'enable', 'run.googleapis.com', 'cloudbuild.googleapis.com',
    'artifactregistry.googleapis.com', 'firestore.googleapis.com', 'cloudtasks.googleapis.com',
    'secretmanager.googleapis.com', 'firebase.googleapis.com', 'firebasehosting.googleapis.com',
    'identitytoolkit.googleapis.com', 'firebasestorage.googleapis.com', 'storage.googleapis.com', 'aiplatform.googleapis.com')

$firebaseProjectsJson = & firebase projects:list --json --non-interactive
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível consultar os projetos Firebase.' }
$firebaseProjects = ($firebaseProjectsJson -join "`n" | ConvertFrom-Json).result
if (-not ($firebaseProjects | Where-Object { $_.projectId -eq $DevProject })) {
    Invoke-DevFirebase -Arguments @('projects:addfirebase', $DevProject)
}

$databases = @(Get-DevGcloud -Arguments @('firestore', 'databases', 'list'))
if (-not ($databases | Where-Object { $_.name -eq "projects/$DevProject/databases/(default)" })) {
    Invoke-DevGcloud -Arguments @('firestore', 'databases', 'create', '--database=(default)',
        "--location=$DevRegion", '--type=firestore-native')
}
$queues = @(Get-DevGcloud -Arguments @('tasks', 'queues', 'list', "--location=$DevRegion"))
if (-not ($queues | Where-Object { $_.name -like '*/queues/conflora-jobs-dev' })) {
    Invoke-DevGcloud -Arguments @('tasks', 'queues', 'create', 'conflora-jobs-dev', "--location=$DevRegion")
}
$accounts = @(Get-DevGcloud -Arguments @('iam', 'service-accounts', 'list'))
foreach ($name in @('conflora-dev-runtime', 'conflora-dev-build')) {
    if (-not ($accounts | Where-Object { $_.email -eq "$name@$DevProject.iam.gserviceaccount.com" })) {
        Invoke-DevGcloud -Arguments @('iam', 'service-accounts', 'create', $name)
    }
}
foreach ($role in @('roles/datastore.user', 'roles/cloudtasks.enqueuer', 'roles/aiplatform.user')) {
    Invoke-DevGcloud -Arguments @('projects', 'add-iam-policy-binding', $DevProject,
        "--member=serviceAccount:$DevRuntimeAccount", "--role=$role", '--condition=None') | Out-Null
}
Invoke-DevGcloud -Arguments @('projects', 'add-iam-policy-binding', $DevProject,
    "--member=serviceAccount:$DevBuildAccount", '--role=roles/run.builder', '--condition=None') | Out-Null

$secrets = @(Get-DevGcloud -Arguments @('secrets', 'list'))
foreach ($name in @('conflora-admin-secret', 'conflora-task-secret')) {
    if (-not ($secrets | Where-Object { $_.name -like "*/secrets/$name" })) {
        Invoke-DevGcloud -Arguments @('secrets', 'create', $name, '--replication-policy=automatic')
    }
    Invoke-DevGcloud -Arguments @('secrets', 'add-iam-policy-binding', $name,
        "--member=serviceAccount:$DevRuntimeAccount", '--role=roles/secretmanager.secretAccessor') | Out-Null
}
Write-Host 'Recursos básicos do confloraai-dev preparados. Nenhum dado de produção foi copiado.'
Write-Host 'Próximo: configurar app Web/Auth/Storage do Firebase e preencher os quatro secrets, conforme docs/DEV-PIX-REAL.md.'
