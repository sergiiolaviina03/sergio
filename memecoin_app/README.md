# MemeRadar

Web app móvil (PWA) para descubrir y analizar memecoins en directo en Solana, Ethereum, Base, BNB, Arbitrum, Sui, TON y Tron.

## Qué hace
- **Radar en directo**: junta tokens de DexScreener (perfiles nuevos, boosts, top, community takeovers y búsqueda rotando 60+ palabras clave) y GeckoTerminal (pools en tendencia y nuevos por cadena). Refresco cada 10–90 s.
- **22 pruebas instantáneas por token**, ejecutadas en el móvil en microsegundos: liquidez, liquidez/MC, FDV vs MC, edad, volumen, wash-trading, compras/ventas, posibilidad de vender, actividad, ballenas, desplomes, sobreextensión, dump en curso, redes, web, perfil, tendencia, par de cotización, DEX, market cap, aceleración de volumen y hype pagado.
- **Hasta 15 pruebas on-chain** para las mejores señales: GoPlus Security (honeypot, impuestos, mint, freeze, proxy, owner oculto, blacklist, pausable, LP bloqueada, top holders…) y RugCheck en Solana.
- **Score 0–100** (60 % seguridad + 40 % momentum) con veredicto COMPRA FUERTE / COMPRA / VIGILAR / EVITAR, motivos, tamaño de posición, TP y SL sugeridos. Perfiles conservador / equilibrado / degen.
- Ficha con gráfico de DexScreener, enlaces y botón para comprar en Jupiter / Uniswap / PancakeSwap con tu wallet.
- Favoritos con alertas de precio y notificaciones de señales fuertes.
- **Cartera simulada** ($10.000 virtuales) y **piloto automático simulado** con take profit, stop loss y trailing stop.

## Desplegar en Netlify
En Netlify: *Add new site → Import from Git*, elige este repo y pon **Base directory** = `memecoin_app` (sin comando de build).
O arrastra la carpeta `memecoin_app` a https://app.netlify.com/drop.
`netlify.toml` crea proxies `/api/*` para evitar problemas de CORS con las APIs de seguridad.

## Aviso
No es asesoramiento financiero. Las memecoins son extremadamente arriesgadas y ninguna prueba garantiza beneficios ni detecta todas las estafas.
