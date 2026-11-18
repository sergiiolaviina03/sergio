from stories_real import S, B, M
G = dict(skin='#e0a77a', hair='#2a1a10', style='short', shirt='#1a1a1a')
MODA = dict(id='moda_aki_explicado', title='Moda AKI', voice=M, rate='+20%', pitch='+0Hz',
    cast=dict(a=dict(G, shirt='#c0262d'), b=dict(G, style='long', hair='#5a3a22', skin='#f0c4a0', shirt='#2b6cb0'),
              c=dict(G, style='slick', skin='#c98b5f', shirt='#3a7a5a', glasses=True), d=dict(G, style='bun', hair='#1a1a1a', shirt='#e8a33a'),
              e=dict(G, style='curly', skin='#d9a07a', shirt='#7a5aa0')),
    beats=[
        B('Moda AKI: equipos de cinco personas, pero resultados muy desiguales. ¿Qué falla?', S('duo', who=['a','b','c','d','e'], expr=['neutral','sad','neutral','sad','neutral'], bg='shop', wall='#3a2f2a', floor='#2a2320', y=900), chip='Caso Moda AKI', hit=True),
        B('Puntos fuertes: equipos de tamaño ideal, tiendas que sí cumplen objetivos y encargados motivados.', S('slide', tag='PUNTOS FUERTES', title='Lo que funciona', acc='#48bb78', items=[('✓','Equipos de 5 personas'),('✓','Tiendas que cumplen'),('✓','Encargados implicados')])),
        B('Puntos débiles: liderazgo inestable, mucha rotación y encargados saturados.', S('slide', tag='PUNTOS DÉBILES', title='Lo que falla', acc='#f56565', items=[('✗','Liderazgo inestable'),('✗','Rotación alta'),('✗','Encargados saturados')])),
        B('Primera medida: liderazgo estable y una reunión semanal de veinte minutos con cada equipo.', S('slide', tag='PRIORIDAD 1', title='Liderazgo + reunión', acc='#4fd1c5', items=[('1','Propósito y 3 objetivos'),('2','Reunión semanal de 20 min'),('3','Estilo según la madurez')])),
        B('Objetivo: en un año, el ochenta por ciento de las tiendas al noventa y cinco por ciento de sus ventas.', S('stamp', text='80%', size=260, sub='de tiendas al 95 % del objetivo', subcol='#7ff5df', top='#06231f', bot='#020a09', glow='#1f9e8a')),
        B('Segunda: un onboarding de noventa días con tutor, para que cada nuevo vendedor rinda en sesenta días.', S('slide', tag='PRIORIDAD 2', title='Onboarding 30-60-90', acc='#f6ad55', items=[('1','Guía de 90 días'),('2','Tutor veterano'),('3','Ritmo normal en 60 días')])),
        B('Y tercera: plan de carrera y reconocimiento, para reducir la rotación un treinta por ciento.', S('slide', tag='PRIORIDAD 3', title='Retención', acc='#9f7aea', items=[('1','Escala de puestos'),('2','Variable por equipo'),('3','-30 % de rotación')])),
        B('Todo empieza con un piloto en tres tiendas: medir, corregir y extender.', S('duo', who=['a','b','c','d','e'], expr='smile', bg='shop', wall='#3a2f2a', floor='#2a2320', y=900), chip='Piloto · 3 tiendas', hit=True),
    ])
