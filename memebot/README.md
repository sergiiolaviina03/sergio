# MemeBot — bot de memecoins en Solana con dashboard

Escanea tokens en tendencia/nuevos de Solana, los filtra (liquidez, edad, volumen, momentum, RugCheck:
mint/freeze authority y concentración de holders), entra con tamaño fijo y sale con take-profit escalonado,
stop-loss, trailing stop y salida por caída de liquidez. Todo se controla desde un dashboard web.

**Empieza SIEMPRE en simulación (`MODE=paper`)**: usa datos de mercado reales en vivo con saldo ficticio
(5 SOL) y aplica un coste simulado del 2 % por operación. Aun así, los fills reales de memecoins suelen ser
peores que los simulados (latencia, MEV, slippage), así que un buen resultado en paper no garantiza nada.

## Arranque rápido (simulación, hoy)

```bash
cd memebot
python3 -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # edita DASHBOARD_PASSWORD y SESSION_SECRET
python run.py
```

Abre http://127.0.0.1:8000, entra con tu contraseña y pulsa **Iniciar bot**.
Tests: `pytest`.

## Dinero real (solo cuando lleves días probando en simulación)

1. Crea una wallet **nueva** (Phantom/Solflare) y envíale solo lo que aceptes perder. No uses tu wallet principal.
2. Exporta su clave privada (base58) y ponla en `.env` como `WALLET_PRIVATE_KEY`. Nunca la subas a GitHub (`.env` está en `.gitignore`).
3. Usa un RPC propio gratuito (Helius, QuickNode, Alchemy) en `SOLANA_RPC_URL`; el público falla bajo carga.
4. En `.env`: `MODE=live` y `LIVE_CONFIRM=YES_I_ACCEPT_THE_RISK`. Sin las dos cosas, el bot sigue en simulación.
5. Baja `POSITION_SIZE_SOL` al empezar (p. ej. 0.02) y vigila las primeras operaciones.

> **Estado del modo real:** el código de swaps vía Jupiter está escrito pero **no ha podido probarse con fondos
> reales** durante el desarrollo. Pruébalo con cantidades mínimas y revisa cada operación en Solscan.

## Despliegue 24/7

El bot solo opera mientras el proceso esté en marcha. Para dejarlo siempre activo, ejecútalo en un VPS
(`HOST=0.0.0.0` detrás de HTTPS/reverse proxy, nunca expuesto sin TLS) o en tu PC encendido.

## Seguridad y límites

- Dashboard con contraseña, cookie `httpOnly`, límite de intentos y texto externo escapado.
- Límites de riesgo: pérdida diaria máxima (detiene el bot), máximo de posiciones, tamaño fijo por operación.
- No hay ninguna garantía de beneficios; es habitual perder el 100 % del capital en memecoins.
- Fuentes de datos: DexScreener, GeckoTerminal, RugCheck y Jupiter (APIs públicas gratuitas con límites de uso).
