$ErrorActionPreference = 'Stop'
$DevProject = 'confloraai-dev'
$DevRegion = 'southamerica-east1'
$DevRuntimeAccount = "conflora-dev-runtime@$DevProject.iam.gserviceaccount.com"
$DevBuildAccount = "conflora-dev-build@$DevProject.iam.gserviceaccount.com"

function Invoke-DevGcloud {
    param([string[]]$Arguments)
    & gcloud @Arguments --project=$DevProject --quiet
    if ($LASTEXITCODE -ne 0) { throw "gcloud falhou: $($Arguments[0..1] -join ' ')" }
}

function Get-DevGcloud {
    param([string[]]$Arguments)
    $result = & gcloud @Arguments --project=$DevProject --quiet --format=json
    if ($LASTEXITCODE -ne 0) { throw "Consulta gcloud falhou: $($Arguments[0..1] -join ' ')" }
    return (($result -join "`n") | ConvertFrom-Json)
}

function Invoke-DevFirebase {
    param([string[]]$Arguments)
    & firebase @Arguments --project $DevProject --non-interactive
    if ($LASTEXITCODE -ne 0) { throw "Firebase falhou: $($Arguments[0])" }
}
