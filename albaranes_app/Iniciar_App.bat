@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo No se encuentra Python instalado en este ordenador.
    echo.
    echo 1. Descargalo desde https://www.python.org/downloads/
    echo 2. Durante la instalacion, marca la casilla "Add Python to PATH".
    echo 3. Vuelve a hacer doble clic en este archivo.
    echo.
    pause
    exit /b 1
)

if not exist "venv\INSTALADO.txt" (
    echo Preparando la aplicacion, esto solo pasa la primera vez y puede tardar un minuto...
    python -m venv venv
    if errorlevel 1 (
        echo.
        echo Hubo un problema creando el entorno de la aplicacion.
        echo Revisa que Python este bien instalado e intentalo de nuevo.
        pause
        exit /b 1
    )

    venv\Scripts\python.exe -m pip install --quiet --upgrade pip
    venv\Scripts\python.exe -m pip install --quiet -r requirements.txt
    if errorlevel 1 (
        echo.
        echo Hubo un problema instalando los componentes necesarios.
        echo Comprueba tu conexion a internet e intentalo de nuevo.
        pause
        exit /b 1
    )

    echo ok > "venv\INSTALADO.txt"
    echo Preparacion completada.
)

start "" "venv\Scripts\pythonw.exe" "main.py"
