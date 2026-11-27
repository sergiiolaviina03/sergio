# Aura · Fichaje, ausencias y nóminas

App web (instalable como app en móvil y escritorio) para control horario con geolocalización, ausencias, nóminas y gestión de equipo. Diseño propio, limpio, con un copiloto que entiende español.

Todo es software libre y se ejecuta en el navegador: React, TypeScript, Tailwind, Framer Motion, Zustand, Leaflet + OpenStreetMap, jsPDF, Tesseract.js (OCR, con el modelo de español autoalojado en `public/ocr`), qrcode y Workbox (PWA). **No depende de ninguna API externa, IA de terceros ni clave**: se puede comercializar y alojar en cualquier servidor estático.

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
| **Documentos y firma** | Envío de documentos a firmar (con plantillas legales), lectura obligatoria hasta el final, resumen automático, firma manuscrita o tipográfica, sello SHA-256 por firma, PDF firmado con acta, seguimiento de quién falta y aviso bloqueante de documentos obligatorios. |
| **Gastos** | Foto del ticket → OCR en el dispositivo (comercio, fecha, total, IVA, categoría), kilometraje a 0,26 €/km, política de gastos (límites, duplicados, sin justificante, fin de semana), aprobación y reembolso en la nómina. |
| **Turnos** | Cuadrante semanal con arrastrar y soltar, plantillas (mañana, tarde, noche…), autocompletar desde el horario, copiar semana, cobertura por franjas, alertas de descanso de 12 h, descanso semanal, exceso de jornada y ausencias; al publicar pasa a ser la jornada prevista. |
| **Personas** | Alta, edición y baja de plantilla (horario, teletrabajo, salario, PIN), organigrama por equipos y datos de la empresa (aparecen en nóminas y PDFs). |
| **Fichaje por QR** | El quiosco muestra un QR que cambia cada 30 s; escanearlo con la cámara del móvil ficha en ese centro aunque no haya GPS. |
| **Aviso de llegada** | Con la app abierta o instalada, al entrar en la geovalla a tu hora te propone fichar. |
| **Copiloto** (`Ctrl K` o botón central en móvil) | Entiende frases como «ficha mi entrada», «¿a qué hora puedo irme?», «vacaciones del 22 al 26 de diciembre», «gasto de 23 € en taxi», «¿tengo documentos por firmar?». Dictado y lectura en voz alta con las funciones del navegador. Todo se procesa en el dispositivo. |
| **Modo quiosco** | Pantalla para una tablet en la entrada de la oficina: fichaje con PIN. |
| **Extras** | Modo oscuro, diseño adaptado a móvil, instalable (PWA) y funciona sin conexión. |

## Servidor y migración

- **Servidor (cuentas, empresas y datos compartidos):** guía en [`supabase/README.md`](supabase/README.md). El esquema [`supabase/schema.sql`](supabase/schema.sql) crea las tablas, los permisos por rol, el sellado de fichajes en el servidor (cadena SHA-256 verificable desde la app), las invitaciones, la firma de documentos y el almacenamiento de archivos. Sin servidor configurado, Aura arranca en modo demostración.
- **Migración desde otro sistema:** *Ajustes → Importar desde otro sistema*. Acepta Excel, CSV, PDFs, imágenes y carpetas enteras; reconoce las columnas (en español o inglés), muestra una vista previa con errores y asigna cada documento a su persona por nombre o DNI. También importa copias completas de otra instalación de Aura (*Ajustes → Exportar copia completa*).
- **Publicación:** cada cambio en `aura_app/` se publica con GitHub Pages mediante `.github/workflows/aura-pages.yml`.

## Estado y siguientes pasos

Pendiente para venderla a empresas:

1. **Servidor en producción**: plan de pago o autoalojado, SMTP propio, copias de seguridad, y opcionalmente un sello de tiempo cualificado (TSA) sobre la cabeza de la cadena cada día.
2. **Nómina oficial**: tablas de bases por grupo de cotización, convenios, regularización de IRPF, ficheros SILTRA/RED y modelos 111/190. Los cálculos actuales son una estimación orientativa.
3. **Normativa**: el reglamento del registro de jornada digital estaba pendiente de publicación en el BOE; revisar el texto final (acceso remoto de la Inspección, formatos de exportación) y adaptar.
4. **Festivos**: ahora incluye los nacionales y los de Madrid; falta el calendario por comunidad autónoma y municipio de cada centro.
5. **Mapas**: las teselas de OpenStreetMap sirven para demos y uso ligero; para clientes, usar un proveedor de teselas contratado o autoalojar PMTiles (cambiar `TILE_URL` en `src/components/MapView.tsx`).
6. **Privacidad (RGPD)**: informar a la plantilla, base legal del tratamiento de la ubicación y la imagen, plazos de conservación (4 años para el registro de jornada).

Los festivos incluidos son los nacionales y de la Comunidad de Madrid (aproximados) para 2026–2027.
