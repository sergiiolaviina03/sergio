#!/usr/bin/env bash
# Mac (doble clic) y Linux (./Iniciar_MemeBot.command). Primera vez: chmod +x Iniciar_MemeBot.command
cd "$(dirname "$0")"
PY=$(command -v python3 || command -v python) || { echo "Instala Python 3: https://www.python.org/downloads/"; read -r -p "Enter para salir"; exit 1; }
echo "Python: $($PY --version)"
[ -d .venv ] || "$PY" -m venv .venv || { echo "No se pudo crear el entorno"; read -r -p "Enter para salir"; exit 1; }
# shellcheck disable=SC1091
. .venv/bin/activate
if [ ! -f .venv/deps_ok ]; then
  echo "Instalando dependencias (solo la primera vez)..."
  pip install --disable-pip-version-check -q -r requirements.txt && touch .venv/deps_ok || { echo "Falló la instalación"; read -r -p "Enter para salir"; exit 1; }
fi
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8765}"
( sleep 4; if command -v open >/dev/null; then open http://127.0.0.1:$PORT; elif command -v xdg-open >/dev/null; then xdg-open http://127.0.0.1:$PORT; fi ) &
python run.py
read -r -p "El bot se ha detenido. Enter para salir"
