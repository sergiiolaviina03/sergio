# Asociador de Albaranes

App de escritorio (con ventana) que lee un PDF con solicitudes, extrae los
números de albarán en el orden en que aparecen, los busca entre tus PDFs de
albaranes ya descargados, y genera un PDF nuevo con los albaranes en ese
mismo orden. Donde no encuentra un albarán, inserta una hoja en blanco.

Se ejecuta en tu propio ordenador (no en la nube), porque necesita acceder
a tus carpetas locales.

## Instalación (una sola vez)

Necesitas Python 3.10 o superior instalado.

```bash
cd albaranes_app
pip install -r requirements.txt
```

En Windows y macOS, Tkinter (la librería de la ventana) viene incluida con
Python. En Linux, si al ejecutar la app da un error de `tkinter`, instálalo
con `sudo apt install python3-tk` (Ubuntu/Debian) o el equivalente de tu
distribución.

## Uso

```bash
python main.py
```

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
