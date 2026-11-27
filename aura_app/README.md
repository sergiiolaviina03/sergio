# Aura · Fichaje, ausencias y nóminas

App web (instalable como app en móvil y escritorio) para control horario con geolocalización, ausencias, nóminas y gestión de equipo. Diseño propio, limpio, con un copiloto que entiende español.

Todo es software libre y gratuito: React, TypeScript, Tailwind, Framer Motion, Zustand, Leaflet + OpenStreetMap y Workbox (PWA). No hace falta ninguna API de pago ni clave.

## Arrancar

**Windows:** doble clic en `Iniciar_Aura.bat` (la primera vez instala lo necesario; requiere [Node.js LTS](https://nodejs.org)).

**Terminal:**

```bash
npm install
npm run dev      # desarrollo, se abre en el navegador
npm run start    # versión optimizada (build + preview)
```

Para probarlo en el móvil con GPS real hace falta HTTPS (o `localhost`). En la demo, la ubicación se simula y se puede cambiar en **Ajustes → Ubicación**.

## Qué incluye

| Módulo | Lo que hace |
|---|---|
| **Fichaje** | Entrada, salida y pausas con contador en vivo, anillo de progreso y hora a la que «cuadras» la jornada. Cada fichaje guarda posición GPS, precisión y centro. |
| **Verificación antifraude** | Geovallas por centro con radio configurable, detección de teletrabajo previsto, precisión baja, ubicación simulada, «viaje imposible» entre fichajes, selfie opcional y puntuación de confianza. Geovalla estricta (bloquea) o flexible (marca para revisión). |
| **Registro sellado** | Cada fichaje se encadena con SHA-256 al anterior. Cualquier edición rompe la cadena y se detecta al verificar (hay un botón para simular una manipulación). Las correcciones nunca borran: se añaden como asientos nuevos y aprobados. Exportación CSV/JSON para la Inspección de Trabajo. |
| **Hoja de horas** | Mes completo con barras de jornada, balance diario, banco de horas, horas extra, mapa de calor, festivos y ausencias; envío y aprobación del periodo. |
| **Detección de incidencias** | Salidas olvidadas (propone la hora según tu histórico), jornadas > 6 h sin pausa (art. 34.4 ET), descanso < 12 h entre jornadas (art. 34.3 ET), jornadas excesivas, fichajes fuera de zona y en festivo. |
| **Ausencias** | Saldos por tipo (días/horas/ilimitado), calendario anual, solicitud en lenguaje natural, cálculo de días laborables descontando festivos, cobertura del equipo y sugerencia de «puentes». |
| **Nóminas** | Recibo mensual con devengos, deducciones y coste empresa (tipos de cotización 2026, IRPF estimado, pagas extra, horas extra sacadas del fichaje), histórico, simulador de salario y coste del equipo. |
| **Equipo en vivo** | Mapa con quién está en cada sede, en remoto, en pausa o ausente; aviso de quién no ha fichado. |
| **Bandeja** | Aprobaciones de ausencias, correcciones y hojas de horas con recomendación automática y aprobación masiva de las seguras. |
| **Copiloto** (`Ctrl K` o botón central en móvil) | Entiende frases como «ficha mi entrada», «¿a qué hora puedo irme?», «vacaciones del 22 al 26 de diciembre», «¿cuánto cobraría con 3.000 € más?», «¿quién está teletrabajando?». Admite dictado por voz. Funciona en el dispositivo, sin enviar datos fuera. |
| **Modo quiosco** | Pantalla para una tablet en la entrada de la oficina: fichaje con PIN. |
| **Extras** | Modo oscuro, diseño adaptado a móvil, instalable (PWA) y funciona sin conexión. |

## Estado y siguientes pasos

Esta versión guarda los datos en el navegador (`localStorage`) con una empresa ficticia de demostración, así que se puede usar y enseñar ya sin servidor. Para producción:

1. **Backend y base de datos** (p. ej. Supabase o Postgres + API) con autenticación, multiempresa y permisos por rol. El sellado debe hacerse también en servidor, con sello de tiempo de confianza.
2. **Nómina oficial**: tablas de bases por grupo de cotización, convenios, regularización de IRPF, ficheros SILTRA/RED y modelos 111/190. Los cálculos actuales son una estimación orientativa.
3. **Normativa**: el reglamento del registro de jornada digital estaba pendiente de publicación en el BOE; revisar el texto final (acceso remoto de la Inspección, formatos de exportación) y adaptar.
4. **Privacidad (RGPD)**: informar a la plantilla, base legal del tratamiento de la ubicación y la imagen, plazos de conservación (4 años para el registro de jornada).

Los festivos incluidos son los nacionales y de la Comunidad de Madrid (aproximados) para 2026–2027.
