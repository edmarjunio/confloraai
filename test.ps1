Write-Host "======================================================" -ForegroundColor Green
Write-Host "  CONFLORA AI - PIPELINE COMPLETO DE TESTES E START" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""

if (-not (Test-Path "package.json")) {
    if (Test-Path "conflora-ai\package.json") {
        Write-Host "[INFO] Entrando na pasta conflora-ai..." -ForegroundColor Yellow
        Set-Location "conflora-ai"
    } else {
        Write-Host "[ERRO] package.json nao encontrado nesta pasta!" -ForegroundColor Red
        Write-Host "Certifique-se de estar na pasta do projeto Conflora AI."
        Exit 1
    }
}

Write-Host "[1/4] Instalando dependencias (npm install)..." -ForegroundColor Cyan
npm install
if ( -ne 0) {
    Write-Host "[FALHA] Erro ao executar npm install." -ForegroundColor Red
    Exit 
}

Write-Host ""
Write-Host "[2/4] Validando sintaxe do codigo (npm run check)..." -ForegroundColor Cyan
npm run check
if ( -ne 0) {
    Write-Host "[FALHA] Erro de sintaxe no codigo." -ForegroundColor Red
    Exit 
}

Write-Host ""
Write-Host "[3/4] Executando testes automatizados (npm test)..." -ForegroundColor Cyan
npm test
if ( -ne 0) {
    Write-Host "[FALHA] Testes falharam." -ForegroundColor Red
    Exit 
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  TUDO VALIDADO E APROVADO COM SUCESSO!" -ForegroundColor Green
Write-Host "  Iniciando o servidor (npm run dev)..." -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""

npm run dev
