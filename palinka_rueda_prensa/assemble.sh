#!/bin/bash
# Concatena intro + clips + outro y mezcla el audio final
set -e
ls clips/intro.mp4 > /dev/null
{ echo "file 'clips/intro.mp4'"; for i in $(seq -w 0 20); do echo "file 'clips/c$i.mp4'"; done; echo "file 'clips/outro.mp4'"; } > concat.txt
ffmpeg -v error -y -f concat -safe 0 -i concat.txt -i audio_final.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart Palinka_CF_Rueda_de_Prensa.mp4
