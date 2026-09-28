# Asociador de Albaranes

App de escritorio (con ventana) que lee un PDF con solicitudes, extrae los
números de albarán en el orden en que aparecen, los busca entre tus PDFs de
albaranes ya descargados, y genera un PDF nuevo con los albaranes en ese
mismo orden. Donde no encuentra un albarán, inserta una hoja en blanco.

Se ejecuta en tu propio ordenador (no en la nube), porque necesita acceder
a tus carpetas locales.

## Uso en Windows (forma fácil, doble clic)

1. Si no tienes Python instalado, descárgalo una sola vez desde
   https://www.python.org/downloads/ e instálalo. **Importante**: en el
   instalador, marca la casilla **"Add Python to PATH"** antes de darle a
   Instalar.
2. Haz doble clic en **`Iniciar_App.bat`** (dentro de esta carpeta
   `albaranes_app`).
   - La primera vez tardará un poco (prepara la aplicación automáticamente).
   - Las siguientes veces se abrirá al momento.
3. Se abrirá la ventana de la aplicación. Sigue los pasos de la sección
   "Cómo se usa" más abajo.

Si Windows te muestra un aviso de "Windows protegió su PC" al abrir el
`.bat` (SmartScreen), pulsa "Más información" → "Ejecutar de todas formas".
Es normal en archivos `.bat` que no llevan una firma digital de pago; el
archivo solo instala las librerías de Python y abre la app.

### Si tus PDFs de solicitudes son escaneos (como el ejemplo que me pasaste)

Tus correos de tráfico se imprimen a PDF como **imágenes escaneadas**, sin
texto seleccionable, así que la app necesita hacer **OCR** (reconocimiento
óptico de caracteres) para leerlos. Para eso, instala una sola vez
**Tesseract OCR**:

1. Descarga el instalador desde
   https://github.com/UB-Mannheim/tesseract/wiki (el de Windows, del
   proyecto UB-Mannheim).
2. Durante la instalación, en la lista de componentes/idiomas, marca
   **"Spanish"** (además del inglés, que viene por defecto).
3. Deja la carpeta de instalación por defecto y termina la instalación.
4. Ya puedes usar la app con normalidad: si una página del PDF no tiene
   texto, se le aplicará OCR automáticamente (puedes desactivarlo con la
   casilla correspondiente si alguna vez no lo necesitas — así va más
   rápido con PDFs que sí tienen texto).

Si al extraer ves el aviso "no se encontró Tesseract OCR instalado" en el
registro de la app, es que falta este paso.

## Instalación manual (alternativa, o para Mac/Linux)

Necesitas Python 3.10 o superior instalado.

```bash
cd albaranes_app
pip install -r requirements.txt
python main.py
```

En Windows y macOS, Tkinter (la librería de la ventana) viene incluida con
Python. En Linux, si al ejecutar la app da un error de `tkinter`, instálalo
con `sudo apt install python3-tk` (Ubuntu/Debian) o el equivalente de tu
distribución.

## Cómo se usa

Se abrirá una ventana:

1. **PDF de solicitudes**: elige el PDF que me envías con las peticiones.
2. **Carpeta de albaranes**: elige la carpeta (y subcarpetas) donde tienes
   guardados los PDFs de albaranes.
3. **PDF de salida**: dónde se guardará el resultado (se rellena solo, pero
   puedes cambiarlo).
4. Pulsa **"1) Extraer números de albarán"**. Aparecerá una línea por cada
   página del PDF, en orden, con el número/código detectado y un comentario
   indicando de qué página viene, por ejemplo:

   ```
   042151    # página 1
   041577    # página 8 (también aparece: 041072)
   (sin código detectado)    # página 43 - revisar
   ```

   **Revisa siempre esta lista antes de continuar.** El texto tras `#` es
   solo informativo (no afecta a la generación del PDF):
   - Si una línea dice "(también aparece: ...)", esa página tenía más de un
     número posible (por ejemplo, un correo que menciona dos albaranes o
     reenvía uno anterior); comprueba en el PDF original cuál es el correcto
     y corrige la línea si hace falta.
   - Si una línea dice "(sin código detectado)", esa página no tenía ningún
     número reconocible con el formato esperado; puedes escribirlo a mano
     mirando esa página del PDF, o dejarlo así para que en el resultado
     final se inserte una hoja en blanco en su lugar.
5. (Opcional) Marca la casilla para que, si un número no aparece en ningún
   nombre de archivo, también se busque dentro del contenido de los PDFs
   (más lento si tienes muchos archivos).
6. Pulsa **"2) Generar PDF"**. Al terminar verás un resumen: cuántos
   albaranes se encontraron y cuáles no (esos llevan una hoja en blanco en
   su lugar dentro del PDF final).

## Cómo empareja los números

- Primero indexa los PDFs de la carpeta de albaranes por su **nombre de
  archivo** (busca números dentro del nombre, ignorando ceros a la
  izquierda y separadores como guiones o puntos).
- Si activas la búsqueda por contenido, para los que no aparezcan en ningún
  nombre de archivo, abre y lee el texto de los PDFs no usados todavía
  hasta encontrar el número.

## Cómo detecta el número/código en cada página

Para cada página prueba, por este orden:

1. Códigos de tipo **"SO123456"** (el formato de los correos de tráfico:
   "SO" + 6 dígitos). Tolera errores típicos del OCR, que a veces convierte
   "SO" en "50", "S0" o incluso "$0".
2. El patrón de la casilla **"Patrón (regex)"** (por defecto, números
   precedidos de la palabra "Albarán" o "Alb.", útil para otro tipo de
   documentos que no usen códigos "SO").

Si ninguno encuentra nada en una página, esa línea queda como "(sin código
detectado)" para que la revises a mano en vez de arriesgarse a adivinar mal.

No todas las páginas de un documento escaneado tienen por qué seguir el
mismo formato: por ejemplo, si el documento mezcla correos de distintos
circuitos de transporte (unos con código "SO...", otros con otras
referencias de mensajería), esas páginas "distintas" se marcarán para
revisión manual en vez de forzar una coincidencia poco fiable.

Si tus solicitudes tienen otro formato distinto y quieres que lo reconozca
automáticamente también, dime cómo aparece exactamente el número en el
texto (una frase de ejemplo) y ajusto el patrón.
