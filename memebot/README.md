# MemeBot v4 — laboratorio de estrategias de memecoins en Solana

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

## Cinco estrategias que compiten (pestaña «Estrategias»)

| | Qué busca |
|---|---|
| 🚀 **Momentum** | Ruptura con presión compradora y volumen que acelera. |
| 🪂 **Dip-buy** | Token que subía fuerte y cae de golpe con compradores volviendo. |
| 🔊 **Volumen oculto** | Volumen disparado con precio aún plano. |
| 🌱 **Lanzamientos** | Tokens de 5-45 min con actividad creciente y liquidez sana. |
| 🌊 **Tendencia** | Subida sostenida en 1 h, 6 h y 24 h (operación más larga). |

Cada una tiene sus propias salidas (stop-loss, take-profits, trailing, duración) y su propia contabilidad.

**Lo que hace distinto a este bot: no asume que algo funciona, lo mide.**
- **Laboratorio estadístico:** por estrategia, rentabilidad media por operación con **intervalo de confianza al 95 %**
  y veredicto: *sin datos · en prueba · sin ventaja · pierde · ventaja ✓*. Hace falta ≥ 30 operaciones con el límite
  inferior del intervalo por encima de 0 para llamarlo «ventaja».
- **Compuerta de evidencia:** con **dinero real solo operan las estrategias con ventaja demostrada**. En simulación
  corren todas para poder medirlas.
- **Reparto de capital adaptativo:** explora al principio y luego da más tamaño (×0,25 a ×2) a lo que gana.
- **Estado del mercado:** mide el % de tokens al alza; en mercado bajista reduce el tamaño a la mitad y exige más convicción.
- **Aprendizaje propio:** entrena un modelo con tus operaciones cerradas y **solo lo usa si acierta con datos que no vio**
  (AUC ≥ 0,58 en el 30 % más reciente). Si solo ve ruido, se queda apagado.
- **Costes realistas en simulación:** 3 % por lado (comisión + deslizamiento + MEV) más el impacto en el pool.
- **Convicción 0-100** (presión compradora, aceleración, momentum, liquidez, edad, seguridad RugCheck/holders): decide
  el tamaño de la entrada (×1 a ×3) y los refuerzos a posiciones ganadoras.
- **Límites:** hasta 30 posiciones, 2 SOL de exposición máxima (50 % por estrategia), pérdida diaria máxima de 1 SOL.

## Lo que dice la evidencia (léelo antes de usar dinero real)

- Un estudio de 1.411 lanzamientos de Solana ([Arrow Algo](https://arrowalgo.com/solana-memecoin-trading/)) midió
  −62 % de media a las 6 h comprando todo y **no encontró ninguna de 416 estrategias significativamente rentable**
  (la mejor en desarrollo ganó +85 % y perdió −81 % fuera de muestra).
- Estudios de Dune/Bitquery: entre el 50 % y el 74 % de los traders de memecoins pierden dinero; los «rankings de
  carteras ganadoras» no pasan los controles (solo el 26 % de las grandes ganancias).
- Los que más ganan (creadores, *bundlers*, snipers a los primeros segundos) usan información que un bot con datos
  públicos no tiene.

Por eso este bot trata cualquier resultado de simulación con escepticismo y obliga a demostrar la ventaja con números.

## Mis resultados de backtest (nov 2026)

57 pools de Solana en tendencia, velas de 1 min, coste 3 % por lado, 4 reglas + control al azar (`tools/RESULTADOS_BACKTEST.txt`):

| Regla | Mejor en DEV | **En HOLDOUT** (datos no vistos) | Con salidas fijas razonables |
|---|---|---|---|
| Ruptura (breakout) | −2,1 % | **−7,4 %** (IC95 −9,6 a −5,2) | −5,2 % |
| Dip-buy | +4,8 % | +6,1 % (IC95 **−10 a +23**, n = 23, mediana −20 %) | −4,2 % |
| Volumen oculto | −4,8 % | **−5,6 %** | −5,6 % |
| **Control (entrar al azar)** | −3,3 % | **−5,0 %** | −5,6 % |

Lectura honesta: **nada supera al azar de forma significativa**; la media por operación está dominada por los costes (6 % ida y vuelta).
Dip-buy es la única que no sale claramente negativa, pero con 23 operaciones y una mediana de −20 % es una lotería, no una ventaja demostrada.
Límites: velas sin datos de compras/ventas, solo pools en tendencia (sesgo de supervivencia, que *favorece* a las reglas) y pocas horas de datos.

## Backtests con datos históricos

```bash
python tools/fetch_history.py hist.json     # baja velas de 1 min de ~160 pools (GeckoTerminal, ~15 min)
python tools/backtest.py hist.json          # simula cada estrategia + CONTROL al azar, con costes y holdout
```
El simulador usa dos mitades (parámetros en DEV, nota en HOLDOUT), asume que el stop salta antes que el objetivo
dentro de una vela, e incluye una estrategia de control al azar: si una regla no la supera, no tiene ventaja.

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
