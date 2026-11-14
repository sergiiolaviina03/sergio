# 15 vídeos listos para subir

Los vídeos están en formato vertical 9:16 (720x1280), con voz en off, subtítulos animados palabra a palabra, música de fondo y efectos de sonido.
Pon la portada en el **primer fotograma**: todos empiezan ya con el gancho.

## Consejos para que funcionen
- Publica **1 o 2 al día**, siempre a la misma hora (entre las 19:00 y las 23:00 suele funcionar bien para terror y true crime).
- Alterna: un caso real, una historia de reglas, otro caso real...
- La pregunta del final está pensada para provocar comentarios: **responde a los primeros comentarios** durante la primera hora.
- Fija un comentario con: *"¿Parte 2? 👇"* en los de ficción.
- En TikTok, añade un sonido en tendencia a volumen 1-3 % si quieres, sin tapar la voz.
- Casos reales: son personas reales. Mantén un tono respetuoso con las víctimas y sus familias en las respuestas.

---

## CASOS REALES

### 01 · El Arropiero
**Texto:** Confesó 48 asesinatos y nunca fue juzgado por ninguno 😳 El caso de Manuel Delgado Villegas, "el Arropiero".
`#truecrime #truecrimeespañol #casosreales #asesinosenserie #elarropiero #misterio #historiasreales #españa`

### 02 · El Mataviejas de Santander
**Texto:** 16 ancianas muertas en Santander y todos creyeron que era por la edad... hasta que encontraron SU habitación.
`#truecrime #truecrimeespañol #santander #casosreales #asesinosenserie #crimenesreales #españa #miedo`

### 03 · El asesino de la baraja
**Texto:** Dejaba cartas de la baraja junto a sus víctimas. Y un día entró borracho en una comisaría... 🃏
`#truecrime #asesinodelabaraja #madrid #casosreales #truecrimeespañol #crimenesreales #misterio`

### 04 · El vecino perfecto de Castellón
**Texto:** Todos decían que era encantador. Era Joaquín Ferrándiz. Y en 2023 salió de prisión.
`#truecrime #castellon #casosreales #truecrimeespañol #asesinosenserie #perfilcriminal #españa`

### 05 · El Hombre Lobo de Allariz
**Texto:** Confesó 13 crímenes y dijo que la culpa era del lobo en el que se convertía 🐺 La historia real de Romasanta.
`#romasanta #hombrelobo #galicia #ourense #truecrime #leyendas #historiadeespaña #misterio`

### 06 · La Vampira del Raval
**Texto:** La llamaron la Vampira de Barcelona... pero ¿y si casi todo era mentira? 🧛‍♀️
`#enriquetamarti #barcelona #elraval #truecrime #historiaoscura #misterio #casosreales #leyendasurbanas`

### 07 · El crimen de Los Galindos
**Texto:** 5 muertos en un cortijo de Sevilla en 1975. Nadie ha pagado por ello. ¿Quién fue?
`#losgalindos #crimensinresolver #sevilla #truecrime #misterio #casosreales #truecrimeespañol #andalucia`

### 08 · Condenada siendo inocente (caso Wanninkhof)
**Texto:** Fue a prisión por un crimen que no cometió... y el verdadero asesino volvió a matar.
`#truecrime #casowanninkhof #malaga #injusticia #casosreales #truecrimeespañol #españa`

### 09 · Eva Blanco: 18 años después
**Texto:** 18 años sin respuestas. Y el ADN de un familiar lo cambió todo 🧬
`#evablanco #algete #adn #truecrime #casosreales #guardiacivil #truecrimeespañol #misterio`

### 10 · El misterio de Helena Jubany
**Texto:** Le dejaron una bebida con somníferos en la puerta. Días después, la mataron. Sigue sin resolverse.
`#helenajubany #sabadell #crimensinresolver #truecrime #misterio #casosreales #truecrimeespañol`

---

## HISTORIAS DE TERROR (FICCIÓN · REGLAS)

### 11 · Reglas del faro de Finisterre
**Texto:** Regla 3: si llaman a la puerta del faro después de medianoche, NO abras. 🌊
`#terror #historiasdeterror #reglas #creepypasta #miedo #finisterre #galicia #historiasdemiedo`

### 12 · Normas del vigilante nocturno
**Texto:** Si en los monitores apareces tú... no te gires. 📹
`#terror #historiasdeterror #reglas #vigilante #creepypasta #miedo #historiasdemiedo #pov`

### 13 · El telefonillo de las 3:33
**Texto:** Si el telefonillo suena a las 3:33, no contestes. Aunque sea la voz de tu madre. 🔔
`#terror #333 #historiasdeterror #creepypasta #bilbao #miedo #historiasdemiedo #paranormal`

### 14 · La gasolinera de la N-340
**Texto:** Norma 2: si llega un coche gris sin matrícula, no salgas. ⛽
`#terror #historiasdeterror #reglas #gasolinera #creepypasta #miedo #carretera #historiasdemiedo`

### 15 · Siempre hay un niño de más
**Texto:** Si al contar a los niños te salen 13... no preguntes quién sobra. 🏕️
`#terror #historiasdeterror #campamento #creepypasta #picosdeeuropa #miedo #historiasdemiedo #reglas`

---

## Hacer más vídeos
En `engine/` está todo el generador (gratis: voz neuronal de Microsoft Edge + animación por código).
Para crear uno nuevo, copia una historia de `stories_real.py` o `stories_fic.py`, cambia el texto y las escenas, y ejecuta:

```
pip install pycairo edge-tts numpy
python3 engine/build_all.py 16_
```
