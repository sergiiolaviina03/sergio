# Aura para iPhone (iOS)

La app de iPhone es la misma Aura empaquetada con Capacitor, igual que la de Android: GPS, cámara para el selfie y los tickets, adaptada a la muesca y con su icono.

## Cómo se compila

Cada cambio en `aura_app/` lanza *Actions → App iOS de Aura* en un Mac de GitHub (gratis en repositorios públicos):

1. **Siempre:** compila la app para el simulador de iPhone y deja `Aura-simulador-iOS.zip` en los artefactos de la ejecución. Sirve para comprobar que todo compila y para probarla en un Mac con Xcode (arrastrar `App.app` al simulador).
2. **Con cuenta de Apple configurada:** firma la app y la sube a **TestFlight** automáticamente. Desde TestFlight la instalas en tu iPhone y en los de los clientes piloto, y desde ahí se envía a revisión para el App Store.

Sin Mac propio: todo ocurre en GitHub.

## Lo que necesitas (una vez)

1. **Apple Developer Program:** 99 USD/año, en [developer.apple.com/programs](https://developer.apple.com/programs/). Mejor como **organización** (necesita el número D-U-N-S de la empresa, gratuito), para que en la tienda aparezca el nombre de tu empresa.
2. En [App Store Connect](https://appstoreconnect.apple.com) → *Apps* → **+** → *Nueva app*: plataforma iOS, nombre «Aura», idioma español, identificador de paquete **app.aura.fichaje** (créalo antes en *Certificates, IDs & Profiles → Identifiers* si no aparece).
3. *Usuarios y acceso → Integraciones → App Store Connect API* → genera una clave con rol **Admin**. Descarga el archivo `.p8` (solo se puede descargar una vez) y apunta el **Key ID** y el **Issuer ID**.
4. Tu **Team ID**: en [developer.apple.com/account](https://developer.apple.com/account) → *Membership details*.

## Configurarlo en GitHub

*Settings → Secrets and variables → Actions → Secrets → New repository secret*:

| Secreto | Valor |
|---|---|
| `APPSTORE_API_KEY_ID` | Key ID de la clave API |
| `APPSTORE_API_ISSUER_ID` | Issuer ID |
| `APPSTORE_API_KEY_P8` | el contenido completo del archivo `.p8` (abrir con el Bloc de notas y copiar todo) |
| `APPLE_TEAM_ID` | Team ID |

Después, en *Actions → App iOS de Aura → Run workflow*. En unos 15 minutos la versión aparece en App Store Connect → TestFlight (la primera vez Apple tarda un poco más en procesarla).

## Publicar en el App Store

En App Store Connect, completa la ficha: capturas de iPhone (6,9" y 6,5"), descripción, palabras clave, URL de soporte, **política de privacidad** (obligatoria) y el cuestionario de privacidad: ubicación precisa (funcionalidad de la app, vinculada a la persona), fotos (opcional), datos de contacto y de uso. Envía a revisión; suele tardar de 1 a 3 días.

Consejo para la revisión: Apple prueba la app sin cuenta de empresa. Deja activa la demostración («Ver la demostración sin cuenta» en la pantalla de acceso) y menciónala en las notas para el revisor.
