@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul || (echo Python no esta instalado. Instalalo desde https://www.python.org/downloads/ marcando "Add python.exe to PATH" y vuelve a abrir este archivo. & pause & exit /b 1)
if not exist .venv (echo Preparando por primera vez, tarda un minuto... & python -m venv .venv)
call .venv\Scripts\activate
pip install -q -r requirements.txt
if exist .env goto arrancar
set /p PW=Elige una contrasena para entrar al panel: 
> .env echo DASHBOARD_PASSWORD=%PW%
>> .env echo SESSION_SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%
>> .env echo MODE=paper
:arrancar
start "" cmd /c "timeout /t 6 >nul & start http://127.0.0.1:8000"
echo.
echo MemeBot en marcha en modo SIMULACION. No cierres esta ventana mientras quieras que funcione.
python run.py
pause
