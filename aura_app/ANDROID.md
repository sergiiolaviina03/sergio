# Aura para Android

La app de Android es la misma Aura empaquetada con Capacitor: GPS nativo, cámara para el selfie y los tickets, botón atrás, icono propio e instalación desde Google Play.

## Descargar e instalar (pruebas)

Cada cambio en `aura_app/` compila la app automáticamente (*Actions → App Android de Aura*) y la publica en:

**https://github.com/sergiiolaviina03/sergio/releases/tag/android-latest**

Abre ese enlace en el móvil, descarga **Aura.apk** y ábrelo. Android pedirá permitir «instalar apps de fuentes desconocidas» para el navegador: acéptalo solo para esta instalación.

Sin firma propia, la APK es de pruebas (firmada con una clave de desarrollo): sirve para enseñarla e instalarla en móviles de clientes piloto, no para Google Play.

## Publicar en Google Play

1. Cuenta de desarrollador de Google Play: 25 USD, pago único. Las cuentas personales nuevas deben probar la app con 12 personas durante 14 días antes de publicarla; una **cuenta de organización** (con número D-U-N-S de la empresa) evita ese requisito.
2. Crea la clave de firma una sola vez (guárdala muy bien: sin ella no podrás actualizar la app). Con Java instalado:

```bash
keytool -genkeypair -v -keystore aura.jks -alias aura -keyalg RSA -keysize 2048 -validity 10000
```

3. En GitHub, *Settings → Secrets and variables → Actions → Secrets*, crea:
   - `ANDROID_KEYSTORE_BASE64`: el archivo `aura.jks` en base64 (`base64 -w0 aura.jks` en Linux o `certutil -encode` en Windows).
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (aura) y `ANDROID_KEY_PASSWORD`.
4. La siguiente compilación generará también **Aura-google-play.aab**, firmado. Súbelo en Play Console → *Producción → Crear versión*.
5. Ficha de la tienda: icono 512×512, capturas del móvil y la política de privacidad (obligatoria por usar ubicación y cámara). En el formulario de «Seguridad de los datos», declara ubicación precisa (para fichar), fotos (selfie y tickets, opcionales) y datos personales de la cuenta.

## Variables (opcionales)

En *Settings → Secrets and variables → Actions → Variables*:

- `SUPABASE_URL` y `SUPABASE_ANON_KEY`: conectan la app con tu servidor desde el primer arranque.
- `PUBLIC_URL`: dirección web pública de Aura (para enlaces de invitación y QR generados desde la app). Por defecto, la de GitHub Pages.

## iPhone

El mismo proyecto puede generar la app de iOS con `npx cap add ios`, pero necesita un Mac con Xcode (o un servicio de compilación en la nube) y la cuenta de Apple Developer (99 USD/año). Mientras tanto, en iPhone Aura se instala desde Safari con *Compartir → Añadir a pantalla de inicio* y funciona con GPS y cámara.
