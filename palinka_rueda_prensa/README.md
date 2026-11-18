# Palinka CF — Rueda de prensa (edición)

Pipeline para convertir el vídeo bruto de la rueda de prensa (`IMG_4915.MOV`, plano fijo con pared amarilla)
en una rueda de prensa "de verdad":

- **Montaje**: se eliminan los parones, el making-of (3:30–4:20 del bruto) y la toma repetida; la
  "repregunta" con el gag del vino (*Producto Nacional*) va al final para que el raccord de la botella cuadre.
- **Fondo**: recorte de personas (MediaPipe selfie-multiclass por zonas + guided filter + llave de color
  sobre el amarillo) y sustitución de la pared por un photocall (`assets/backdrop.png`) con desenfoque de
  profundidad, sombras proyectadas y supresión del reflejo amarillo.
- **Mesa**: faldón oscuro bajo la mesa y micrófonos de sobremesa.
- **Realización**: multicámara virtual (plano general, medios y primeros planos con *push-in*),
  rótulos (mosca, *lower thirds*), subtítulos en español corregidos a mano, cortinilla de entrada/salida.
- **Audio**: filtro paso alto, reducción de ruido, compresión y normalización a -15 LUFS.

## Uso

```bash
python3 transcribe.py audio16k.wav transcript2.json   # faster-whisper large-v3
python3 assets.py                                      # escudo, photocall, faldón
python3 mksubs.py                                      # subs_src.py -> subs.json
python3 render.py intro 4.5; python3 render.py outro 4.0
python3 render.py 0 1 2 ... 20                         # clips (paralelizable)
python3 audio.py && ffmpeg ... (ver assemble.sh)
./assemble.sh
```

`edl.py` contiene la lista de cortes (tiempos del bruto), los encuadres de cada plano y los rótulos.
