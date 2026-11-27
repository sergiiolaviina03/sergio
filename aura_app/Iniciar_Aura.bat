@echo off
setlocal
cd /d "%~dp0"
title Aura

where node >nul 2>nul
if errorlevel 1 (
    echo No se encuentra Node.js en este ordenador.
    echo.
    echo 1. Descargalo gratis desde https://nodejs.org  ^(version LTS^)
    echo 2. Instalalo con las opciones por defecto.
    echo 3. Vuelve a hacer doble clic en este archivo.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\.instalado" (
    echo Preparando Aura, esto solo pasa la primera vez y tarda un minuto...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo Hubo un problema instalando las dependencias. Revisa tu conexion e intentalo de nuevo.
        pause
        exit /b 1
    )
    echo ok> "node_modules\.instalado"
)

echo Abriendo Aura en tu navegador... ^(cierra esta ventana para apagarla^)
call npm run start
pause
