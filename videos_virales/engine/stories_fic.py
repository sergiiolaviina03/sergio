"""Historias de terror originales (ficción) con formato de 'reglas'."""
from stories_real import S, B, M, F

NARR = dict(skin='#e0a77a', hair='#2a1a10', style='short', shirt='#2f4a6a')

FARO = dict(
    id='11_reglas_del_faro', title='Reglas del faro de Finisterre', voice=M,
    cast=dict(yo=dict(NARR, shirt='#2a3a4a', beard=True)),
    beats=[
        B('Si trabajas en un faro y alguien llama a la puerta a las tres de la mañana... no abras. Ahí fuera solo está el mar.', S('door', knock=True), hit=True),
        B('Me contrataron para cuidar el faro de Finisterre durante el invierno. El último farero se fue sin avisar.', S('house', kind='lighthouse'), chip='Costa da Morte · Noviembre'),
        B('Me dejó una hoja pegada en la nevera. Cinco reglas, escritas a mano.', S('object', kind='letter', msg='1. La luz nunca se apaga. 2. Si oyes campanas, cierra las ventanas.')),
        B('Regla uno: la luz nunca se apaga. Pase lo que pase.', S('house', kind='lighthouse', seed=5), chip='Regla 1'),
        B('Regla dos: si oyes campanas en el mar, cierra las ventanas. En esta costa ya no quedan barcos con campana.', S('house', kind='lighthouse', seed=7, moon=None), chip='Regla 2'),
        B('Regla tres: si llaman a la puerta después de medianoche, no abras. El faro está en un acantilado. No hay camino.', S('door', knock=True), chip='Regla 3'),
        B('La primera semana fue tranquila. Viento, lluvia, y la luz girando sobre el agua.', S('char', who='yo', expr='neutral', bg='room')),
        B('Hasta la noche del jueves. A las tres y diez, oí campanas.', S('object', kind='clock', time=(3, 10)), chip='03:10', heart=True),
        B('Cerré las ventanas. Las campanas se acercaban. Y de repente... pararon.', S('char', who='yo', expr='scared', bg='room', push=0.14)),
        B('Tres golpes en la puerta.', S('door', knock=True, feet=True), hit=True),
        B('Una voz de mujer: por favor, me he caído del barco, tengo mucho frío.', S('door', feet=True, peep=True), heart=True),
        B('Miré por la mirilla. Estaba empapada. Pero no temblaba.', S('eyes', who='yo', shrink=True)),
        B('La regla cuatro decía: si te pide entrar, pregúntale su nombre. Si dice el tuyo, sube a la linterna y no bajes hasta el amanecer.', S('object', kind='letter', msg='4. Pregúntale su nombre. Si dice el tuyo, sube.'), chip='Regla 4'),
        B('Le pregunté cómo se llamaba. Y con mi propia voz... me respondió mi nombre.', S('stamp', text='DIJO\nMI NOMBRE'), hit=True),
        B('Subí. Pasé la noche junto a la luz, escuchando cómo algo subía y bajaba la escalera.', S('house', kind='lighthouse', figure=True, fx=330, eyes='#bfe6ff'), heart=True),
        B('Al amanecer leí la regla cinco. Estaba escrita con otra letra: ahora te toca a ti escribir la regla seis.', S('object', kind='letter', msg='5. Ahora te toca a ti escribir la regla 6.'), chip='Regla 5'),
        B('¿Qué regla escribirías tú? Te leo en comentarios.', S('house', kind='lighthouse')),
    ])

VIGILANTE = dict(
    id='12_vigilante_nocturno', title='Normas del vigilante nocturno', voice=M,
    cast=dict(yo=dict(NARR, shirt='#1d2a44', hat='cap', hatc='#111a2e'),
              jefe=dict(skin='#d9a07a', hair='#9a9a9a', style='bald', shirt='#3a3a3a', mustache=True, old=True, glasses=True)),
    beats=[
        B('Si en los monitores de seguridad apareces tú... no te gires.', S('object', kind='monitor', figure=3), hit=True),
        B('Acepté un trabajo de vigilante nocturno en un centro comercial a las afueras de Valencia.', S('hallway', col='#2c3440'), chip='Centro comercial · 22:00'),
        B('El encargado me dio una tarjeta con normas. Léelas dos veces, me dijo. Y se fue sin mirarme.', S('char', who='jefe', expr='sad', bg='office', talk=True)),
        B('Norma uno: haz la ronda cada hora. Nunca subas a la tercera planta. No existe.', S('hallway', col='#2c3440'), chip='Norma 1'),
        B('Norma dos: los maniquíes de la segunda planta miran a la escalera mecánica. Si alguno te mira a ti, apaga la linterna y cuenta hasta treinta.', S('hallway', col='#3a3440', mannequin=True), chip='Norma 2'),
        B('Norma tres: si alguien aparece en la cámara cuatro, no salgas de la garita.', S('object', kind='monitor', figure=3), chip='Norma 3'),
        B('La primera noche, a las dos y cuarto, hice la ronda.', S('object', kind='clock', time=(2, 15)), chip='02:15'),
        B('Un maniquí estaba girado hacia mí. Apagué la linterna. Conté. Uno... dos... tres...', S('hallway', col='#1a1a22', mannequin=True), heart=True),
        B('Al llegar a treinta, la encendí. El maniquí volvía a mirar a la escalera. Pero estaba más cerca.', S('hallway', col='#3a3440', mannequin=True, push=0.3), hit=True),
        B('Volví corriendo a la garita y miré los monitores.', S('char', who='yo', expr='scared', bg='office')),
        B('En la cámara cuatro había alguien. Sentado en una garita. Mirando unos monitores.', S('object', kind='monitor', figure=3), heart=True),
        B('Era yo.', S('stamp', text='ERA YO', size=150), hit=True, hold=0.5),
        B('Norma cuatro: si una cámara te enseña a ti, no te gires. Lo que tienes detrás solo existe si lo miras.', S('eyes', who='yo', stare=True), chip='Norma 4'),
        B('Sentí una respiración en la nuca. Fría. Muy cerca.', S('eyes', who='yo', shrink=True, stare=True), heart=True),
        B('Han pasado seis horas. Sigo sin girarme. Y el turno de mañana... no ha llegado.', S('object', kind='clock', time=(8, 15)), chip='08:15'),
        B('¿Tú te girarías? Comenta.', S('hallway', figure=True, eyes='#ff2b2b')),
    ])

TELEFONILLO = dict(
    id='13_telefonillo_333', title='El telefonillo de las 3:33', voice=M,
    cast=dict(yo=dict(NARR, shirt='#5a3a3a'),
              casera=dict(skin='#eab894', hair='#d9d9d9', style='bun', shirt='#4a3a5a', old=True, glasses=True),
              vecino=dict(skin='#c98b5f', hair='#3a3a3a', style='bald', shirt='#3a5a4a', old=True, mustache=True)),
    beats=[
        B('Si el telefonillo suena a las tres y treinta y tres de la mañana, no contestes. Aunque sea la voz de tu madre.', S('door', intercom=True), hit=True),
        B('Me mudé a un piso antiguo en el casco viejo de Bilbao. Barato. Demasiado barato.', S('house', kind='block', window=(3, 2)), chip='Bilbao · Casco Viejo'),
        B('La casera me dio las llaves y una advertencia: si el telefonillo suena de madrugada, no contestes.', S('char', who='casera', expr='sad', bg='room', talk=True)),
        B('Me reí. Hasta la primera noche.', S('char', who='yo', expr='smile', bg='room')),
        B('Tres y treinta y tres. El telefonillo suena.', S('object', kind='clock', time=(3, 33)), chip='03:33', hit=True),
        B('No contesté. Volvió a sonar. Y otra vez. Siete veces.', S('door', intercom=True), heart=True),
        B('A la mañana siguiente, el vecino del cuarto me preguntó: ¿anoche contestaste? Le dije que no. Suspiró aliviado.', S('char', who='vecino', expr='scared', bg='room', talk=True)),
        B('El que vivía antes en tu piso sí contestó, me dijo. Y todavía no ha vuelto.', S('char', who='vecino', expr='sad', bg='room', push=0.14), hit=True),
        B('Segunda noche. Tres y treinta y tres. El telefonillo. Y a la vez, vibra mi móvil.', S('object', kind='phone', time='3:33', **{'from': 'Mamá'}, msg='Estoy abajo. Ábreme, por favor.'), chip='03:33', heart=True),
        B('Era un mensaje de mi madre: estoy abajo, ábreme, por favor.', S('object', kind='phone', time='3:33', **{'from': 'Mamá'}, msg='Estoy abajo. Ábreme, por favor.')),
        B('Mi madre vive a cuatrocientos kilómetros. Y a esas horas siempre duerme.', S('eyes', who='yo', shrink=True)),
        B('La llamé. Me contestó medio dormida, desde su cama.', S('char', who='yo', expr='scared', bg='room')),
        B('Y entonces, sin que yo descolgara, por el telefonillo se oyó su voz: hijo, ¿por qué no me abres?', S('door', intercom=True, feet=True), hit=True),
        B('No dormí. Y a las tres y treinta y cuatro... alguien empezó a subir las escaleras.', S('hallway', figure=True, col='#2a2420'), chip='03:34', heart=True),
        B('Sígueme si quieres saber qué había detrás de la puerta.', S('door', peep=True, feet=True)),
    ])

GASOLINERA = dict(
    id='14_gasolinera_n340', title='La gasolinera de la N-340', voice=M,
    cast=dict(yo=dict(NARR, shirt='#c0262d'),
              mujer=dict(skin='#e8c0a0', hair='#1a1a1a', style='longstraight', shirt='#e8e8e8', eyes='#000000')),
    beats=[
        B('Nunca le pongas gasolina a un coche gris sin matrícula. Y nunca lleves a nadie al pueblo.', S('house', kind='gas', car=True), hit=True),
        B('Trabajo en el turno de noche de una gasolinera perdida en la N-340, entre Almería y Murcia.', S('house', kind='gas'), chip='N-340 · 00:40'),
        B('El primer día, mi compañero me dejó tres normas apuntadas en un pósit.', S('object', kind='letter', msg='1. Desde las 2, solo efectivo. 2. Coche gris: NO salgas.')),
        B('Uno: después de las dos de la mañana, solo se cobra en efectivo.', S('char', who='yo', expr='neutral', bg='office'), chip='Norma 1'),
        B('Dos: si llega un coche gris sin matrícula, no salgas. Espera a que se vaya.', S('house', kind='gas', car=True), chip='Norma 2'),
        B('Tres: si una mujer te pide que la lleves al pueblo, dile que no hay pueblo. Porque no lo hay.', S('char', who='mujer', expr='neutral', bg='street'), chip='Norma 3'),
        B('Tres y media de la mañana. Unos faros en la carretera.', S('house', kind='gas', car=True), chip='03:30', heart=True),
        B('Un coche gris. Sin matrícula. Se para junto al surtidor dos. No baja nadie.', S('house', kind='gas', car=True, push=0.15)),
        B('Pasan diez minutos. Veinte. Y de repente, el surtidor empieza a funcionar solo.', S('stamp', text='500 L', size=220, sub='y subiendo'), hit=True),
        B('Entonces llaman a la ventanilla. Es una mujer. Me sonríe.', S('char', who='mujer', expr='creepy', bg='office', push=0.14), heart=True),
        B('¿Me llevas al pueblo? Mi coche se ha quedado sin gasolina.', S('char', who='mujer', expr='smile', bg='office', talk=True)),
        B('Detrás de ella, el coche gris estaba vacío. La puerta del conductor, abierta.', S('house', kind='gas', car=True), hit=True),
        B('Le dije que no había pueblo. Y dejó de sonreír.', S('char', who='mujer', expr='angry', bg='office')),
        B('Eso mismo me dijo tu compañero, susurró. Y mira dónde está ahora.', S('eyes', who='mujer', stare=True, shrink=True), hit=True),
        B('¿Qué crees que le pasó al compañero? Comenta.', S('house', kind='gas')),
    ])

CAMPAMENTO = dict(
    id='15_campamento_picos', title='Siempre hay un niño de más', voice=M,
    cast=dict(director=dict(skin='#d9a07a', hair='#7a7a7a', style='short', shirt='#2f6b4a', beard=True, old=True),
              n1=dict(skin='#f0c4a0', hair='#5a3a22', style='kid', shirt='#e8a33a', cheeks=True),
              n2=dict(skin='#c98b5f', hair='#1a1a1a', style='curly', shirt='#e8a33a', cheeks=True),
              n3=dict(skin='#eab894', hair='#c9a24a', style='long', shirt='#e8a33a', cheeks=True),
              n4=dict(skin='#e0a77a', hair='#3a2418', style='kid', shirt='#e8a33a', cheeks=True),
              n5=dict(skin='#f4d0b4', hair='#1a1a1a', style='kid', shirt='#e8a33a', eyes='#000000')),
    beats=[
        B('En aquel campamento había una norma: si al contar a los niños te salen trece, no preguntes quién sobra.', S('stamp', text='13', size=280, sub='y solo había 12'), hit=True),
        B('Verano de 2009. Fui monitor en un campamento en los Picos de Europa.', S('house', kind='camp'), chip='Picos de Europa · 2009'),
        B('Doce niños. Seis tiendas. Y una norma que el director repetía cada noche.', S('duo', who=['n1', 'n2', 'n3', 'n4'], expr='smile', bg='field')),
        B('Cuenta a los niños antes de dormir. Si te salen trece, no preguntes quién sobra.', S('char', who='director', expr='sad', bg='field', talk=True), chip='La norma'),
        B('La primera noche conté doce. La segunda, doce.', S('duo', who=['n1', 'n2', 'n3', 'n4'], expr='neutral', bg='field')),
        B('La tercera noche, junto a la hoguera... conté trece.', S('object', kind='fire'), chip='Noche 3', hit=True),
        B('Volví a contar. Trece. Todos con la camiseta del campamento. Todos sonriendo.', S('duo', who=['n1', 'n2', 'n5', 'n3', 'n4'], expr=['smile', 'smile', 'creepy', 'smile', 'smile'], bg='field'), heart=True),
        B('Pero uno de ellos no tenía sombra a la luz del fuego.', S('char', who='n5', expr='creepy', bg='field', push=0.16), hit=True),
        B('Hice lo que dijo el director. No pregunté nada. A las doce, todos a las tiendas.', S('house', kind='camp')),
        B('A las tres de la mañana me despertó una voz infantil junto a mi tienda.', S('forest', eyes=True, n=1), chip='03:00', heart=True),
        B('Monitor... ¿por qué no me has preguntado cómo me llamo?', S('eyes', who='n5', stare=True), hit=True),
        B('No contesté. Me tapé con el saco. La voz se alejó, riéndose.', S('forest', figure=True, figeyes='#ffffff')),
        B('Al amanecer, conté a los niños. Once.', S('stamp', text='11', size=280, sub='faltaba uno'), chip='Amanecer', hit=True),
        B('El director ni se inmutó. Solo dijo: este año se ha llevado a uno. El año pasado fueron dos.', S('char', who='director', expr='tired', bg='field', talk=True)),
        B('¿Tú habrías preguntado su nombre? Sígueme para la parte dos.', S('house', kind='camp', figure=True, fx=560, eyes='#ffffff')),
    ])

FIC = [FARO, VIGILANTE, TELEFONILLO, GASOLINERA, CAMPAMENTO]
