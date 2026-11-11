# MemeBot — bot de memecoins en Solana (más riesgo, más operaciones, salidas rápidas)

Bot de memecoins con panel web moderno: gráficos en directo por token, radar de candidatos, avisos,
confeti en las ganancias y vista pensada para el móvil. **Empieza en simulación** (datos de mercado reales,
saldo ficticio de 5 SOL, coste simulado del 2 % por operación) y **arranca solo** al abrirlo.

## Cómo arrancarlo (elige uno)

| Si tienes… | Haz esto |
|---|---|
| **Windows** | Descarga el ZIP, extrae, entra en `memebot` y doble clic en **`Iniciar_MemeBot.bat`**. Instala/detecta Python solo, guarda un registro en `memebot_log.txt` y te dice qué falla. |
| **Mac / Linux** | Doble clic (o `./Iniciar_MemeBot.command`) dentro de `memebot`. |
| **Nada instalado** | En GitHub: *Code → Codespaces → Create codespace on `claude/gifted-mccarthy-lc79dc`*. Arranca solo y abre el panel; el enlace también vale en el móvil. (Se apaga tras ~30 min sin uso y gasta horas gratuitas: sirve para probar, no para 24/7.) |

La **primera vez** el panel te pide **crear tu contraseña** (no hace falta editar ningún archivo). Solo se puede crear
desde el propio ordenador donde corre el bot.

## Verlo desde el móvil

1. Abre el bot con `Iniciar_MemeBot.bat` (deja entrar a tu wifi; si Windows pregunta por el Firewall, **Permitir**).
2. En el panel, pestaña **Móvil**: escanea el QR con la cámara del móvil (misma wifi) y entra con tu contraseña.
3. iPhone: *Compartir → Añadir a pantalla de inicio*. Android: *⋮ → Instalar app*.
4. Fuera de casa: usa **Tailscale** (gratis) en el PC y el móvil. **No expongas el panel directamente a internet.**

## Estrategia (perfil «Degen» por defecto)

- **Radar:** ~20 fuentes (DexScreener, GeckoTerminal, RugCheck, búsqueda por palabras) → ~100 tokens a la vez,
  escaneo cada 5 s, monitor de posiciones cada 2 s, gráficos cada 1 s.
- **Convicción 0-100** por token: presión compradora 5m, tendencia 1h, aceleración de volumen y de actividad,
  momentum, profundidad de liquidez, edad y seguridad (RugCheck/holders). Entra a partir de 42 puntos y
  **cuanto mayor la convicción, más grande la entrada** (de x1 a x3 el tamaño base).
- **Refuerzo:** si una posición gana +7 % y la convicción sigue ≥ 65, añade una vez (1,5× base).
- **Salidas cortas:** stop-loss 18 %, vende el 60 % con +14 %, el resto con +45 % o trailing 9 %,
  cierra si pierde la presión compradora con ganancia, si no se mueve en 6 min o a los 25 min. Cada salida
  se confirma con 2 lecturas seguidas para ignorar ticks falsos del feed.
- **Límites:** hasta 30 posiciones, exposición máxima 2 SOL a la vez, pérdida diaria máxima 1 SOL (detiene el bot).
- Perfiles en *Ajustes*: Conservador · Equilibrado · **Degen** · Locura.

> Más riesgo y más operaciones significan también pérdidas más rápidas. La «convicción» es una heurística,
> no una predicción. Vigila el historial en simulación antes de usar dinero real.

## Dinero real (solo tras días de simulación)

1. Wallet **nueva** (Phantom/Solflare) con solo lo que aceptes perder.
2. `pip install -r requirements-live.txt` (usa `solders`; no hace falta para simular).
3. Crea `.env` (copia `.env.example`): `MODE=live`, `LIVE_CONFIRM=YES_I_ACCEPT_THE_RISK`, `WALLET_PRIVATE_KEY=...`
   y un `SOLANA_RPC_URL` propio (Helius/QuickNode/Alchemy). Nunca subas `.env` a GitHub.
4. Baja `POSITION_SIZE_SOL` y `MAX_EXPOSURE_SOL` al empezar. En modo real el bot **no arranca solo**.

> El código de swaps con Jupiter **no ha podido probarse con fondos reales**. Empieza con cantidades mínimas.
> En real, las ejecuciones son más lentas y peores que en simulación (latencia, MEV, slippage).

## Datos técnicos

Python + FastAPI + SQLite, sin compilar nada para simular (`requirements.txt`). Tests: `pip install -r requirements-dev.txt && pytest`.
Datos: DexScreener, GeckoTerminal, RugCheck y Jupiter (APIs públicas con límites de uso; hay freno automático ante 429).
