@echo off
setlocal enabledelayedexpansion

echo ======================================================
echo   CONFLORA AI - PIPELINE COMPLETO DE TESTES E START
echo ======================================================
echo.

if not exist "package.json" (
  if exist "conflora-ai\package.json" (
    echo [INFO] Entrando na pasta conflora-ai...
    cd conflora-ai
  ) else (
    echo [ERRO] package.json nao encontrado nesta pasta!
    echo Certifique-se de estar na pasta do projeto Conflora AI.
    pause
    exit /b 1
  )
)

echo [1/4] Instalando/atualizando dependencias (npm install)...
call npm install
if %ERRORLEVEL% neq 0 (
  echo [FALHA] Erro ao executar npm install.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo [2/4] Validando sintaxe de todo o codigo (npm run check)...
call npm run check
if %ERRORLEVEL% neq 0 (
  echo [FALHA] Erro de sintaxe encontrado no codigo.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo [3/4] Executando bateria de testes automatizados (npm test)...
call npm test
if %ERRORLEVEL% neq 0 (
  echo [FALHA] Algum teste falhou. Corrija antes de iniciar.
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo ======================================================
echo   TUDO VALIDADO E APROVADO COM SUCESSO!
echo   Iniciando o servidor (npm run dev)...
echo ======================================================
echo.
call npm run dev
