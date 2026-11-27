# Aura · Plan para empezar a vender en 2 semanas

Precios consultados en noviembre de 2026. Las cifras de terceros son orientativas: confírmalas al contratar.

## 1. Qué se vende

Control horario con geolocalización, registro sellado e inalterable, fichaje por app, web, QR de quiosco y WhatsApp, ausencias, documentos con firma, gastos con lectura de tickets, turnos, previsión de nómina y migración desde otras herramientas.

**Argumentos frente a la competencia**

- Registro de jornada con sellado criptográfico verificable y exportación para la Inspección.
- Fichar por WhatsApp sin instalar nada (ideal para comercio, hostelería, limpieza y obra).
- Migración guiada desde Factorial, Sesame, Woffu, A3 o Excel en una tarde.
- Precio claro, sin mínimos de 15 personas ni planes ocultos.

## 2. Precios de la competencia (referencia)

| Producto | Precio publicado |
|---|---|
| Sesame HR Essential | 4,75 €/empleado/mes (anual), mínimo 15 empleados |
| Factorial | desde 5,50 €/persona/mes |
| Woffu Lite | desde 1,50 €/usuario/mes, solo hasta 10 empleados |

## 3. Propuesta de precios de Aura

| Plan | Precio | Incluye |
|---|---|---|
| **Fichaje** | 2,50 €/empleado/mes, mínimo 19 €/mes | Control horario (app, web, QR, WhatsApp), registro sellado, ausencias, hoja de horas, exportación para Inspección |
| **Completo** | 4,50 €/empleado/mes, mínimo 35 €/mes | Todo lo anterior + documentos con firma, gastos con OCR, turnos, previsión de nómina, copiloto |
| **Empresa** | a medida (desde 50 empleados) | Servidor dedicado o autoalojado, soporte prioritario, integraciones |

- 30 días gratis, sin tarjeta. Sin permanencia. Pago anual con 2 meses gratis.
- Migración incluida gratis: es la mejor palanca para que alguien se cambie.
- Programa para asesorías laborales: 20 % recurrente por cliente traído. Son quienes recomiendan el software a las pymes.

Ejemplo: una tienda de 12 empleados en el plan Completo paga 54 €/mes. Con 20 clientes así, son unos 1.080 €/mes.

## 4. Costes fijos para arrancar

| Concepto | Coste | Notas |
|---|---|---|
| Supabase Pro (servidor, base de datos, archivos) | 25 USD/mes | Incluye la instancia pequeña; el plan gratuito se pausa por inactividad y no sirve para clientes |
| Web (Cloudflare Pages o Netlify) | 0 € | GitHub Pages vale para la demo, pero no está pensado para un SaaS comercial |
| Dominio (p. ej. aura-fichaje.es) | 10–15 €/año | |
| Email transaccional (Resend, Brevo…) | 0 € al principio | Planes gratuitos de unos cientos de correos al día |
| WhatsApp Business Platform | 0 € por fichar | Las respuestas a mensajes de la persona no se cobran en España; los recordatorios, unos 0,02 € cada uno |
| Número para WhatsApp | ~5 €/mes | Una línea móvil o virtual que no se use en el WhatsApp normal |
| Mapas comerciales | 0–25 €/mes | Teselas propias (Protomaps) o un proveedor de pago |
| Google Play | 25 USD una vez | |
| Apple App Store (opcional) | 99 USD/año | Hasta entonces, la web instalable funciona en iPhone |
| Cobros (Stripe) | ~1,5 % + 0,25 € por cobro con tarjeta europea | La domiciliación SEPA es más barata |

**Total para empezar:** unos 40–60 €/mes, más unos 125 € de pagos únicos (Google Play y dominio).

**Una sola vez, fuera de la tecnología:**

- Alta como autónomo o S.L.
- Textos legales (aviso legal, privacidad, condiciones del servicio y contrato de encargado del tratamiento para cada cliente): de 300 a 800 € con un abogado.
- Seguro de responsabilidad civil y ciberriesgos (recomendable).

## 5. Plan de 2 semanas

### Semana 1: montar y probar con un cliente real

| Día | Tarea | Quién |
|---|---|---|
| 1 | Crear las cuentas: Supabase Pro, dominio, Cloudflare, Meta Business, Google Play (de organización), Stripe | Tú |
| 1 | Pasarme la URL y la clave pública de Supabase: lo dejo conectado y desplegado en tu dominio | Tú → yo |
| 2 | Verificación de empresa en Meta y alta del número de WhatsApp; despliegue del bot | Tú + yo |
| 2–3 | Encargar los textos legales; añadirlos a la app y a la tienda | Tú + yo |
| 3–5 | Piloto con 1–2 empresas conocidas: migración real de sus datos, alta de su plantilla y una semana fichando | Tú, con mi apoyo |

### Semana 2: cobrar y salir

| Día | Tarea | Quién |
|---|---|---|
| 6–7 | Corregir lo que salga del piloto | Yo |
| 6–8 | Web comercial con precios, alta autónoma y prueba gratis; cobros con Stripe (suscripción por empleado) | Yo |
| 7 | Subir la app a Google Play (la revisión suele tardar unos días) | Tú, con la guía de `ANDROID.md` |
| 8–9 | Calendario de festivos por comunidad autónoma y municipio; avisos por email (documentos, aprobaciones, olvidos de fichaje) | Yo |
| 10 | Lanzamiento: 20 asesorías laborales de tu zona, LinkedIn, comercios cercanos | Tú |

## 6. Lo que aún falta construir para vender

1. **Web comercial y cobros:** página de precios, alta de empresa con prueba de 30 días, Stripe Checkout, límites por plan y avisos de fin de prueba.
2. **Festivos** por comunidad autónoma y municipio de cada centro (ahora solo nacionales y Madrid).
3. **Avisos por email y push:** documento pendiente, solicitud aprobada, olvido de fichaje.
4. **Panel de proveedor** para ti: empresas, planes, uso y soporte.
5. **App de iPhone**, cuando haya demanda (necesita la cuenta de Apple).

## 7. Riesgos que conviene dejar claros

- **Nómina:** es una previsión. Véndela como «prenómina» y exportación para la asesoría, no como nómina oficial.
- **Registro digital obligatorio:** el reglamento estaba pendiente de publicarse en el BOE. Cuando salga, habrá que ajustar formatos y el acceso de la Inspección (la arquitectura ya lo permite).
- **Protección de datos:** ubicación e imagen son datos sensibles para la plantilla. Hay que informar a cada empleado (la plantilla «Política de registro de jornada y geolocalización» ya está en Documentos) y firmar el contrato de encargado del tratamiento con cada cliente.
- **WhatsApp:** permite enviar una ubicación elegida en el mapa. Por eso esos fichajes quedan marcados para revisión si caen fuera del centro.
