@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title MemeBot
set "LOG=%~dp0memebot_log.txt"
echo === MemeBot %DATE% %TIME% === > "%LOG%"
echo.
echo   MemeBot - arrancando...
echo.

rem ---- 1. Buscar un Python que funcione (ignora el falso "python" de la Microsoft Store)
set "PY="
for %%C in ("py -3" "python" "python3") do (
  if not defined PY (
    %%~C -c "import sys;sys.exit(0 if sys.version_info[:2]>=(3,9) else 1)" >nul 2>&1 && set "PY=%%~C"
  )
)
if not defined PY if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set PY="%LocalAppData%\Programs\Python\Python312\python.exe"
if not defined PY if exist "%LocalAppData%\Programs\Python\Python313\python.exe" set PY="%LocalAppData%\Programs\Python\Python313\python.exe"
if not defined PY (
  echo [!] No encuentro Python en este ordenador.
  where winget >nul 2>&1 && (
    echo     Intentando instalarlo automaticamente con winget...
    winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    echo.
    echo     Si la instalacion ha terminado: CIERRA esta ventana y abre otra vez Iniciar_MemeBot.bat
  )
  echo.
  echo     Si no se ha instalado, descargalo de https://www.python.org/downloads/
  echo     y MARCA la casilla "Add python.exe to PATH" en el instalador.
  echo Python no encontrado >> "%LOG%"
  pause
  exit /b 1
)
echo [ok] Python encontrado: %PY%
%PY% --version
%PY% --version >> "%LOG%" 2>&1

rem ---- 2. Entorno virtual (solo la primera vez)
if not exist ".venv\Scripts\python.exe" (
  echo [1/3] Creando entorno, solo la primera vez...
  %PY% -m venv .venv >> "%LOG%" 2>&1
  if errorlevel 1 goto :fail
)

rem ---- 3. Dependencias (solo la primera vez)
if not exist ".venv\deps_ok.txt" (
  echo [2/3] Instalando dependencias, puede tardar un minuto...
  ".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements.txt >> "%LOG%" 2>&1
  if errorlevel 1 goto :fail
  echo ok> ".venv\deps_ok.txt"
)

rem ---- 4. Arrancar (HOST=0.0.0.0 permite verlo tambien desde el movil en tu wifi)
set "HOST=0.0.0.0"
echo [3/3] Arrancando MemeBot...
echo.
echo   Se abrira el navegador en unos segundos. Si ves "conexion rechazada", pulsa F5.
echo   Si Windows pregunta por el Firewall, pulsa PERMITIR (es para verlo desde el movil).
echo   NO CIERRES ESTA VENTANA mientras quieras que el bot funcione.
echo.
start "" cmd /c "timeout /t 6 >nul & start http://127.0.0.1:8000"
".venv\Scripts\python.exe" run.py
if errorlevel 1 goto :fail
pause
exit /b 0

:fail
echo.
echo ==================== ALGO HA FALLADO ====================
echo Mira el ultimo texto de arriba. Registro guardado en:
echo   %LOG%
echo.
echo Si el error dice "address already in use": ya tienes MemeBot abierto en otra ventana.
echo Si no lo entiendes, haz una captura de ESTA ventana y enviamela.
echo ---------------- ultimas lineas del registro ----------------
powershell -NoProfile -Command "Get-Content -Tail 25 -LiteralPath '%LOG%'"
echo.
pause
exit /b 1
