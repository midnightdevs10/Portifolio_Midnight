@echo off
REM ==========================================================
REM  MIDNIGHT DEVS — Servidor local
REM  Duplo-clique neste arquivo pra abrir o site no navegador.
REM  Necessario porque file:// bloqueia WebGL e CDNs.
REM ==========================================================

cd /d "%~dp0"

REM Tenta Python 3 primeiro (mais comum)
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo [Midnight Devs] Iniciando servidor Python na porta 8000...
    echo [Midnight Devs] Abrindo navegador em http://localhost:8000
    start "" http://localhost:8000
    python -m http.server 8000
    goto end
)

REM Tenta py launcher
where py >nul 2>nul
if %errorlevel% equ 0 (
    echo [Midnight Devs] Iniciando servidor Python na porta 8000...
    echo [Midnight Devs] Abrindo navegador em http://localhost:8000
    start "" http://localhost:8000
    py -3 -m http.server 8000
    goto end
)

REM Tenta Node (npx)
where npx >nul 2>nul
if %errorlevel% equ 0 (
    echo [Midnight Devs] Iniciando servidor Node na porta 8000...
    echo [Midnight Devs] Abrindo navegador em http://localhost:8000
    start "" http://localhost:8000
    npx --yes http-server -p 8000 -c-1
    goto end
)

echo [Midnight Devs] ERRO: nem Python nem Node encontrados.
echo Instale Python (https://python.org) ou Node (https://nodejs.org).
pause

:end