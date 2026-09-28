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
4. Pulsa **"1) Extraer números de albarán"**. Aparecerá la lista de números
   detectados, en orden, en el cuadro de texto editable. Revísala: puedes
   añadir, borrar o corregir líneas a mano si algo no se ha detectado bien.
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

## Si el PDF de solicitudes es un escaneo (imagen, sin texto seleccionable)

Esta versión extrae texto directamente del PDF. Si tu PDF de solicitudes es
una imagen escaneada sin texto real debajo, la extracción automática dará
0 resultados — en ese caso puedes escribir los números de albarán a mano en
el cuadro editable (en el orden correcto) y pulsar directamente
"2) Generar PDF". Si quieres que añada reconocimiento óptico (OCR) para
estos casos, dímelo y lo incorporo.

## Ajustar el patrón de detección

El campo "Patrón (regex)" controla cómo se reconoce un número de albarán en
el texto. Por defecto busca cosas como "Albarán nº 12345" o "Alb. 12345".
Si tus solicitudes tienen otro formato y la extracción falla, dime cómo
aparece exactamente el número de albarán en el texto (una frase de ejemplo)
y ajusto el patrón por defecto.
