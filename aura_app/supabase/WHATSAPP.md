# Fichar por WhatsApp

Las personas escriben al número de WhatsApp de Aura («entrada», «pausa», «vuelvo», «salida» o «¿cuántas horas llevo?»). El bot pide la ubicación con un botón, comprueba la geovalla de su centro (o su teletrabajo previsto) y sella el fichaje en la misma cadena que la app, con método «whatsapp». Un solo número sirve para todas las empresas clientes: cada persona se identifica por el móvil de su ficha.

Requisitos: servidor Supabase configurado (ver [README.md](README.md)) y el esquema actualizado (vuelve a ejecutar `schema.sql`; es seguro repetirlo).

## 1. Número y app en Meta (gratis)

1. En [developers.facebook.com](https://developers.facebook.com) crea una app de tipo **Business** y añade el producto **WhatsApp**.
2. Para probar, Meta da un número de pruebas (puedes escribir desde hasta 5 móviles verificados). Para clientes, añade tu número propio en *WhatsApp → API Setup → Add phone number* y verifica tu empresa en el *Business Manager* (tarda de 1 a 5 días).
3. Crea un **usuario del sistema** en *Business Settings → System users*, dale acceso a la app y genera un **token permanente** con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
4. Anota: **Phone number ID** (en *API Setup*), el **token** y el **App Secret** (*App settings → Basic*).

## 2. Desplegar la función en Supabase

Desde la carpeta `aura_app`, en un ordenador con Node.js:

```bash
npx supabase login
```

```bash
npx supabase functions deploy whatsapp --project-ref TU_REF --no-verify-jwt
```

```bash
npx supabase secrets set --project-ref TU_REF WA_TOKEN=... WA_PHONE_ID=... WA_APP_SECRET=... WA_VERIFY_TOKEN=una-palabra-secreta-inventada
```

`TU_REF` es el identificador del proyecto (lo que va antes de `.supabase.co`). `--no-verify-jwt` es necesario porque Meta no envía sesión de Supabase; la función verifica en su lugar la firma de Meta con el App Secret.

## 3. Conectar el webhook

En Meta, *WhatsApp → Configuration → Webhook*:

- **Callback URL:** `https://TU_REF.supabase.co/functions/v1/whatsapp`
- **Verify token:** la palabra que pusiste en `WA_VERIFY_TOKEN`
- Pulsa *Verify and save* y suscríbete al campo **messages**.

## 4. Activarlo en Aura

- En *Ajustes → Fichar por WhatsApp* escribe el número y decide si se pide la ubicación (recomendado).
- En *Personas*, añade el **móvil** de cada persona. Solo esos números pueden fichar.
- En *Mi jornada* aparecerá el botón «Fichar por WhatsApp», que abre la conversación con el texto preparado.

## Costes

Cuando la persona escribe primero, la respuesta del bot es una conversación de servicio, que Meta no cobra en España. Solo costarían los mensajes que Aura enviara por iniciativa propia (por ejemplo, recordatorios de fichar), a unos 0,02 € cada uno según la tarifa de Meta. Comprueba la tarifa vigente en la página de precios de WhatsApp Business Platform.

## Límites a tener en cuenta

- WhatsApp deja compartir una ubicación elegida en el mapa, no solo la real. Por eso estos fichajes llevan la marca `ubicacion_whatsapp` y, si caen fuera del centro, `fuera_de_zona` para revisión. Para máxima garantía, la app con GPS o el QR del quiosco son más fiables.
- Si un móvil está en varias empresas, se usa la última con la que habló.
