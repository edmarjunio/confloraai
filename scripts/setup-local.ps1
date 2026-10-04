$ErrorActionPreference = "Stop"

Write-Host "== Conflora AI: preparação local ==" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js não encontrado. Instale o Node.js LTS antes de continuar."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm não encontrado. Reinstale o Node.js LTS."
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Arquivo .env criado. Preencha os valores antes de iniciar." -ForegroundColor Yellow
}

npm install
npm run check
npm test

Write-Host "OK. Dependências instaladas e verificações concluídas." -ForegroundColor Green
