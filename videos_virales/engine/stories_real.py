"""Casos reales de España. Narración basada en hechos ampliamente documentados en prensa.
En los casos sin resolver NO se señala a ningún sospechoso vivo."""


def S(type, **kw):
    kw['type'] = type; return kw


def B(say, scene, chip='', hit=False, heart=False, hold=0.0):
    return dict(say=say, scene=scene, chip=chip, hit=hit, heart=heart, hold=hold)


M = 'es-ES-AlvaroNeural'
F = 'es-ES-ElviraNeural'

ARROPIERO = dict(
    id='01_el_arropiero', title='El Arropiero: 48 confesiones', voice=M,
    cast=dict(manuel=dict(skin='#c98b5f', hair='#1d1410', style='short', shirt='#5a4a3a'),
              guardia=dict(skin='#e0a77a', hair='#222', shirt='#2f5a3a', hat='tricornio', mustache=True),
              antonia=dict(skin='#e8b48c', hair='#3a2418', style='long', shirt='#8a3b5a', cheeks=True)),
    beats=[
        B('Confesó cuarenta y ocho asesinatos. Y nunca fue juzgado por ninguno.', S('stamp', text='48\nCONFESIONES', sub='0 CONDENAS'), hit=True),
        B('Enero de 1971. El Puerto de Santa María, Cádiz.', S('map', lon=-6.23, lat=36.6, label='El Puerto de Santa María', year='1971'), chip='Enero · 1971'),
        B('Una mujer llamada Antonia desaparece. La última persona que la vio con vida fue su novio.', S('char', who='antonia', expr='sad', bg='street'), chip='El Puerto · 1971'),
        B('Un hombre callado, de mirada perdida, al que todos llamaban el Arropiero.', S('char', who='manuel', expr='creepy', bg='bar', push=0.12), heart=True),
        B('El apodo venía de su padre, que vendía arrope, un dulce típico, por las calles.', S('object', kind='jar', label='ARROPE')),
        B('La Guardia Civil lo detiene. Y entonces pasa algo que nadie esperaba.', S('duo', who=['guardia', 'manuel'], expr=['angry', 'creepy'], bg='police'), chip='Comisaría', hit=True),
        B('Empieza a confesar. Un hombre en una playa de Garraf, en 1964. Una turista francesa en Ibiza.',
          S('map', pins=[('Garraf', 1.9, 41.25), ('Ibiza', 1.43, 38.98), ('El Puerto', -6.23, 36.6)]), chip='Sus confesiones'),
        B('Habla de crímenes en media España. Incluso en Francia y en Italia. En total, cuarenta y ocho muertes.', S('stamp', text='48', sub='según su propia confesión', size=260)),
        B('Su arma, casi siempre, eran sus propias manos. Un golpe seco en el cuello que decía haber aprendido en la Legión.', S('eyes', who='manuel', lid=0.35, stare=True), heart=True),
        B('Los investigadores lo llevan de ciudad en ciudad para reconstruir cada crimen. Solo una parte pudo comprobarse.', S('evidence', items=['Garraf 1964', 'Ibiza 1967', 'Madrid', 'Barcelona', {'who': 'manuel', 'label': 'M. Delgado'}])),
        B('Pero nunca llegó a sentarse ante un juez. Los médicos lo declararon enfermo mental.', S('court', judge=True, verdict='SIN JUICIO'), hit=True),
        B('Pasó años encerrado sin condena, entre la prisión y el psiquiátrico.', S('char', who='manuel', expr='tired', bg='cell'), chip='Sin juicio'),
        B('Murió en 1998, en Badalona, sin haber sido condenado por ninguno de sus crímenes.', S('news', headline='Muere el Arropiero sin ser juzgado', date='1998', who='manuel')),
        B('Hoy se le considera uno de los mayores asesinos en serie de la historia de España.', S('stamp', text='EL\nARROPIERO', sub='Manuel Delgado Villegas')),
        B('¿Cuántas de esas cuarenta y ocho confesiones crees que eran verdad? Te leo en comentarios.', S('eyes', who='manuel', shrink=True)),
    ])

MATAVIEJAS = dict(
    id='02_el_mataviejas', title='El Mataviejas de Santander', voice=M,
    cast=dict(jose=dict(skin='#e2ae86', hair='#2a1a10', style='slick', shirt='#4a5a6a'),
              abuela=dict(skin='#eab894', hair='#d9d9d9', style='bun', shirt='#6a3a4a', old=True, glasses=True),
              abuela2=dict(skin='#e0a77a', hair='#bfbfbf', style='bun', shirt='#3a4a6a', old=True)),
    beats=[
        B('Dieciséis mujeres mayores murieron en Santander. Y durante meses, todos pensaron que había sido por causas naturales.', S('stamp', text='16\nANCIANAS', sub='Santander · 1987'), hit=True),
        B('1987. Santander.', S('map', lon=-3.8, lat=43.46, label='Santander', year='1987'), chip='Cantabria · 1987'),
        B('Un hombre joven, educado, de buena presencia, llama a la puerta de mujeres que viven solas.', S('door', knock=True, feet=True), chip='Ding dong'),
        B('Se presenta como albañil. Les ofrece arreglar una gotera, una puerta, una ventana.', S('char', who='jose', expr='smile', bg='room', talk=True)),
        B('Ellas le abren. Le ofrecen un café. Confían en él.', S('duo', who=['abuela', 'jose'], expr=['smile', 'smile'], bg='room', lamp=(360, 300))),
        B('Días después, la mujer aparece muerta en su casa. Sin heridas visibles. Sin señales de lucha.', S('char', who='abuela2', expr='tired', bg='room', look=(0, 0.5)), heart=True),
        B('Los médicos lo atribuyen a la edad. Una muerte tras otra.', S('news', headline='Otra anciana hallada muerta en su domicilio', date='Santander · 1988')),
        B('Hasta que los investigadores descubren algo que tenían en común: el mismo albañil había pasado por sus casas.', S('evidence', items=['Víctima 1', 'Víctima 2', 'Víctima 3', 'Víctima 4', {'who': 'jose', 'label': 'EL ALBAÑIL'}]), hit=True),
        B('Mayo de 1988. Lo detienen. Se llama José Antonio Rodríguez Vega.', S('object', kind='handcuffs'), chip='Mayo · 1988'),
        B('Y en su casa, la policía encuentra una habitación que hiela la sangre.', S('hallway', open=True, col='#3a2a22'), heart=True),
        B('Estaba llena de objetos: televisores, figuritas, relojes. Recuerdos que se llevaba de cada víctima.', S('object', kind='shelf'), chip='La habitación'),
        B('Fue condenado a cuatrocientos cuarenta años de prisión.', S('court', who='jose', verdict='440 AÑOS'), hit=True),
        B('Pero en 2002, en la cárcel de Topas, en Salamanca, otros presos acabaron con su vida.', S('char', who='jose', expr='scared', bg='cell'), chip='Topas · 2002'),
        B('En Santander todavía lo recuerdan por un nombre: el Mataviejas.', S('stamp', text='EL\nMATAVIEJAS')),
        B('¿Tú le habrías abierto la puerta? Sígueme para más casos reales de España.', S('door', peep=True, feet=True)),
    ])

BARAJA = dict(
    id='03_asesino_de_la_baraja', title='El asesino de la baraja', voice=M,
    cast=dict(alfredo=dict(skin='#e0a77a', hair='#1a1a1a', style='short', shirt='#3b4a2e'),
              policia=dict(skin='#d9a07a', hair='#222', shirt='#1d2a44', hat='cap', mustache=True)),
    beats=[
        B('Una carta de la baraja. Un as de copas. Junto a un cadáver.', S('object', kind='card', label='1', glow='#ff9a9a'), hit=True),
        B('Madrid, febrero de 2003.', S('map', lon=-3.7, lat=40.42, label='Madrid', year='2003'), chip='Febrero · 2003'),
        B('Un portero es asesinado de un disparo en un portal. Sin robo. Sin motivo aparente.', S('street', walker=None), chip='Madrid'),
        B('Junto al cuerpo, los agentes encuentran una carta. El as de copas.', S('object', kind='card', label='1'), heart=True),
        B('En las semanas siguientes, más disparos. En un bar de Alcalá de Henares. En una parada de autobús de Arganda.',
          S('map', pins=[('Madrid', -3.7, 40.42), ('Alcalá', -3.36, 40.48), ('Arganda', -3.44, 40.3)]), chip='Comunidad de Madrid'),
        B('Las víctimas no tienen nada en común. No las conoce. No les roba.', S('evidence', items=['Portal', 'Bar', 'Parada bus', '?', '?'])),
        B('Y en algunas escenas vuelve a aparecer una carta de la baraja española.', S('object', kind='card', label='2'), hit=True),
        B('Madrid vive con miedo. La prensa lo bautiza: el asesino de la baraja.', S('news', headline='El asesino de la baraja vuelve a matar', date='Madrid · 2003')),
        B('Seis muertos. Y ni un solo sospechoso.', S('stamp', text='6\nMUERTOS', sub='0 sospechosos')),
        B('Hasta el 3 de julio. Un hombre entra borracho en la comisaría de Puertollano.', S('char', who='alfredo', expr='drunk', bg='police'), chip='Puertollano · 3 julio'),
        B('Dice: soy el asesino de la baraja. Y los agentes... no le creen.', S('duo', who=['policia', 'alfredo'], expr=['neutral', 'drunk'], bg='police'), hit=True),
        B('Pero conoce detalles que solo el asesino podría saber.', S('eyes', who='alfredo', lid=0.3, stare=True), heart=True),
        B('Se llamaba Alfredo Galán. Exmilitar. Había estado destinado en Bosnia, y de allí se trajo la pistola.', S('char', who='alfredo', expr='creepy', bg='cell', push=0.12)),
        B('Fue condenado a más de ciento cuarenta años de prisión.', S('court', who='alfredo', verdict='+140 AÑOS'), hit=True),
        B('Y lo más escalofriante: según su declaración, la primera carta fue casualidad. Las demás las dejó porque los periódicos ya lo llamaban así.', S('object', kind='card', label='1')),
        B('¿Por qué crees que se entregó? Te leo en comentarios.', S('eyes', who='alfredo', shrink=True)),
    ])

FERRANDIZ = dict(
    id='04_joaquin_ferrandiz', title='El vecino perfecto de Castellón', voice=M,
    cast=dict(joaquin=dict(skin='#e6b28c', hair='#3a2a1a', style='slick', shirt='#dfe6ee', tie='#3a4a7a', glasses=True),
              guardia=dict(skin='#d9a07a', hair='#222', shirt='#2f5a3a', hat='tricornio')),
    beats=[
        B('Era el vecino perfecto. Simpático, trabajador, buen hijo. Y había matado a cinco mujeres.', S('char', who='joaquin', expr='smile', bg='office'), hit=True),
        B('Castellón, mediados de los años noventa.', S('map', lon=-0.04, lat=39.99, label='Castellón', year='1995'), chip='Castellón · 1995'),
        B('Entre 1995 y 1996, cinco mujeres desaparecen en la provincia.', S('evidence', items=['1995', '1995', '1996', '1996', '?'])),
        B('Sus cuerpos van apareciendo, uno tras otro, en zonas de campo.', S('forest', seed=8), heart=True),
        B('La provincia entera tiene miedo. Pero nadie sospecha de Joaquín.', S('char', who='joaquin', expr='neutral', bg='office', look=(0, 0))),
        B('Trabajaba en una compañía de seguros. Sus compañeros decían que era encantador.', S('char', who='joaquin', expr='smile', bg='office', talk=True), chip='Oficina de seguros'),
        B('Lo que casi nadie sabía es que años antes había sido condenado por una violación.', S('news', headline='Condenado por agresión sexual', date='1989', who='joaquin'), hit=True),
        B('Y que había salido de prisión antes de tiempo, en 1995. Justo cuando empezaron las desapariciones.', S('object', kind='calendar', month='1995', day='!', year='sale de prisión')),
        B('La Guardia Civil hace algo casi nuevo en España: un perfil psicológico del asesino.', S('char', who='guardia', expr='neutral', bg='police'), chip='Perfil criminal'),
        B('Un hombre joven, de aspecto normal, con antecedentes, que conoce bien la zona.', S('evidence', items=['Joven', 'Normal', 'Antecedentes', 'Conoce la zona', {'who': 'joaquin', 'label': '¿?'}])),
        B('Ese perfil encajaba con un nombre. En 1998, lo detienen.', S('object', kind='handcuffs'), chip='1998', hit=True),
        B('Fue condenado a sesenta y nueve años de cárcel.', S('court', who='joaquin', verdict='69 AÑOS')),
        B('Pero en 2023, después de veinticinco años entre rejas, Joaquín Ferrándiz salió en libertad.', S('news', headline='Joaquín Ferrándiz sale de prisión', date='2023', who='joaquin'), hit=True),
        B('¿Crees que alguien así puede cambiar? Comenta.', S('eyes', who='joaquin', lid=0.2, shrink=True)),
    ])

ROMASANTA = dict(
    id='05_hombre_lobo_allariz', title='El Hombre Lobo de Allariz', voice=M,
    cast=dict(manuel=dict(skin='#d9a07a', hair='#2a1a10', style='short', shirt='#5a3a22', beard=True, hat='beret'),
              reina=dict(skin='#f0c8a8', hair='#3a2418', style='bun', shirt='#7a1a2a', earrings='#e8c14a')),
    beats=[
        B('Confesó trece asesinatos. Y dijo que no fue él... sino el lobo en el que se convertía.', S('eyes', kind='wolf'), hit=True),
        B('Galicia, mediados del siglo diecinueve.', S('map', lon=-7.8, lat=42.19, label='Allariz, Ourense', year='1852'), chip='Galicia · S. XIX'),
        B('Por los caminos de Ourense viaja un vendedor ambulante. Amable. Educado. Se llama Manuel Blanco Romasanta.', S('char', who='manuel', expr='smile', bg='field')),
        B('Se ofrece a guiar a mujeres y niños por la montaña, hasta casas donde, dice, les espera un trabajo.', S('forest', walker='manuel')),
        B('Pero nadie vuelve a saber de ellos.', S('forest', eyes=True, n=3), heart=True),
        B('Y empiezan los rumores. Dicen que Manuel vende un unto, una grasa... de origen humano.', S('object', kind='jar', label='UNTO'), chip='Leyenda'),
        B('En 1852 lo detienen en Toledo, viviendo con un nombre falso.', S('map', lon=-4.5, lat=40.15, label='Nombela, Toledo'), chip='1852', hit=True),
        B('Y confiesa. Trece muertes.', S('stamp', text='13', size=280, sub='muertes confesadas')),
        B('Pero añade algo que deja helado al tribunal: una maldición lo convertía en lobo.', S('char', who='manuel', expr='creepy', bg='court', push=0.14), heart=True),
        B('Decía que vivía días en el monte, con otros lobos, y que no controlaba lo que hacía.', S('forest', figure=True, figeyes='#ffd23f')),
        B('Lo condenan a muerte. Pero un hipnotista francés escribe a la reina: ese hombre está enfermo.', S('object', kind='letter', msg='Majestad: ese hombre sufre una enfermedad...')),
        B('Isabel segunda le perdona la vida. Pasaría el resto de sus días en prisión.', S('char', who='reina', expr='neutral', bg='court'), chip='Isabel II'),
        B('Hoy lo conocen como el Hombre Lobo de Allariz. El primer asesino en serie documentado de España.', S('stamp', text='EL HOMBRE\nLOBO', sub='de Allariz')),
        B('¿Monstruo, enfermo... o mentiroso? Tú decides en comentarios.', S('eyes', kind='wolf')),
    ])

ENRIQUETA = dict(
    id='06_vampira_del_raval', title='La Vampira del Raval', voice=F,
    cast=dict(enriqueta=dict(skin='#e2b08a', hair='#1a1410', style='bun', shirt='#2a2a2a', old=False),
              teresita=dict(skin='#f0c4a0', hair='#5a3a22', style='kid', shirt='#c0606a', cheeks=True),
              vecina=dict(skin='#e8b48c', hair='#3a2418', style='long', shirt='#4a6a5a')),
    beats=[
        B('La llamaron la Vampira de Barcelona. Pero puede que casi todo lo que te contaron sobre ella... sea mentira.', S('stamp', text='LA\nVAMPIRA', sub='Barcelona · 1912'), hit=True),
        B('Barcelona, febrero de 1912. Barrio del Raval.', S('map', lon=2.17, lat=41.38, label='El Raval, Barcelona', year='1912'), chip='Febrero · 1912'),
        B('Una niña de cinco años, Teresita, desaparece en plena calle.', S('char', who='teresita', expr='scared', bg='street')),
        B('La ciudad la busca durante más de dos semanas. Nada.', S('news', headline='Sigue sin aparecer la pequeña Teresita', date='Barcelona · 1912'), heart=True),
        B('Hasta que una vecina mira por una ventana... y ve a una niña con la cabeza rapada.', S('house', kind='block', window=(2, 1)), chip='Calle Ponent'),
        B('Era Teresita. Estaba en el piso de una mujer llamada Enriqueta Martí.', S('duo', who=['teresita', 'enriqueta'], expr=['scared', 'creepy'], bg='room'), hit=True),
        B('Los periódicos se vuelven locos. Dicen que secuestraba niños.', S('news', headline='Horror en la calle Ponent', date='1912', who='enriqueta', expr='creepy')),
        B('Que con su sangre fabricaba pócimas para gente rica. Que guardaba huesos en su casa.', S('object', kind='jar', label='?', glow='#ff7a7a'), heart=True),
        B('Barcelona entera la odia. La apodan la Vampira del Raval.', S('char', who='enriqueta', expr='creepy', bg='street', push=0.12)),
        B('Pero nunca llegó a ser juzgada. Murió en la cárcel en 1913, en circunstancias extrañas.', S('char', who='enriqueta', expr='sad', bg='cell'), chip='1913'),
        B('Décadas después, una historiadora revisó el caso.', S('object', kind='letter', msg='Expediente Enriqueta Martí')),
        B('Su conclusión: muchas de esas historias de sangre y pócimas nunca se probaron. Las alimentó la prensa.', S('stamp', text='¿MITO?', sub='Nada de eso se probó'), hit=True),
        B('¿Monstruo real... o víctima del amarillismo? Comenta qué crees.', S('eyes', who='enriqueta', stare=True)),
    ])

GALINDOS = dict(
    id='07_crimen_de_los_galindos', title='El crimen de Los Galindos', voice=M,
    cast=dict(capataz=dict(skin='#c98b5f', hair='#2a2a2a', style='short', shirt='#e8e2d0', mustache=True, old=True),
              juana=dict(skin='#d9a07a', hair='#2a1a10', style='bun', shirt='#3a3a3a'),
              jose=dict(skin='#c98b5f', hair='#1a1a1a', style='short', shirt='#5a6a7a'),
              ramona=dict(skin='#e0a77a', hair='#3a2418', style='bun', shirt='#6a4a3a'),
              juan=dict(skin='#d9a07a', hair='#2a1a10', style='curly', shirt='#4a5a3a')),
    beats=[
        B('Cinco muertos en un cortijo. Más de cincuenta años después, nadie sabe quién lo hizo.', S('stamp', text='5\nMUERTOS', sub='0 culpables'), hit=True),
        B('22 de julio de 1975. Paradas, Sevilla.', S('map', lon=-5.5, lat=37.29, label='Paradas, Sevilla', year='1975'), chip='22 julio · 1975'),
        B('En el cortijo de Los Galindos, una tarde de verano, alguien ve una columna de humo.', S('house', kind='cortijo', fire=True), chip='Cortijo Los Galindos'),
        B('Arde un pajar. Los vecinos acuden a apagarlo.', S('object', kind='fire')),
        B('Y entre la paja quemada aparecen cuerpos.', S('house', kind='cortijo', fire=True, lit=False), hit=True, heart=True),
        B('Dentro de la casa, más víctimas. El capataz, Manuel Zapata, y su mujer, Juana.', S('duo', who=['capataz', 'juana'], expr=['tired', 'tired'], bg='room')),
        B('En total, cinco personas muertas. Dos matrimonios y un tractorista.', S('duo', who=['capataz', 'juana', 'jose', 'ramona', 'juan'], expr='sad', bg='field')),
        B('La primera teoría: uno de los trabajadores, José González, mató a todos y luego se quitó la vida.', S('char', who='jose', expr='sad', bg='field'), chip='Primera teoría'),
        B('Pero los análisis forenses posteriores apuntaron a que José no era el asesino. Era otra víctima.', S('evidence', items=['Capataz', 'Juana', 'Ramona', 'Juan', {'who': 'jose', 'label': '¿José?'}]), hit=True),
        B('Entonces... ¿quién mató a cinco personas a plena luz del día?', S('eyes', who='capataz', stare=True), heart=True),
        B('Se habló de cuentas del cortijo. De secretos que alguien quería enterrar. Nada se demostró.', S('object', kind='letter', msg='Cuentas del cortijo 1975 ...')),
        B('Se investigó durante veinte años. Y en 1995, el crimen prescribió.', S('news', headline='Prescribe el crimen de Los Galindos', date='1995'), chip='1995'),
        B('Si el asesino sigue vivo, hoy es libre. Y nunca pagará.', S('evidence', items=['?', '?', '?', '?', '?'], stamp='PRESCRITO'), hit=True),
        B('¿Quién crees que lo hizo? Te leo en comentarios.', S('house', kind='cortijo', lit=True)),
    ])

WANNINKHOF = dict(
    id='08_caso_wanninkhof', title='Condenada siendo inocente', voice=F,
    cast=dict(dolores=dict(skin='#e2b08a', hair='#4a3a2a', style='short', shirt='#3a4a5a'),
              rocio=dict(skin='#f0c4a0', hair='#c9a24a', style='long', shirt='#6a8aba', cheeks=True),
              king=dict(skin='#f2c4a8', hair='#8a6a4a', style='short', shirt='#5a5a4a')),
    beats=[
        B('Pasó diecisiete meses en la cárcel por un asesinato que no cometió. Y mientras tanto, el verdadero asesino seguía libre.', S('stamp', text='INOCENTE', sub='y condenada'), hit=True),
        B('Octubre de 1999. Mijas, Málaga.', S('map', lon=-4.64, lat=36.6, label='Mijas, Málaga', year='1999'), chip='Octubre · 1999'),
        B('Rocío Wanninkhof, una chica de diecinueve años, desaparece una noche en La Cala de Mijas.', S('char', who='rocio', expr='neutral', bg='street')),
        B('Semanas después encuentran su cuerpo.', S('forest', seed=12), heart=True),
        B('Toda España sigue el caso. Y las sospechas caen sobre Dolores Vázquez, la expareja de la madre de Rocío.', S('char', who='dolores', expr='sad', bg='police'), chip='La sospechosa'),
        B('No hay pruebas directas. Pero buena parte de la prensa ya la ha condenado.', S('news', headline='Dolores Vázquez, en el punto de mira', date='2000', who='dolores')),
        B('En 2001, un jurado popular la declara culpable. Quince años de prisión.', S('court', who='dolores', verdict='CULPABLE'), hit=True),
        B('Ella siempre repitió lo mismo: yo no fui.', S('char', who='dolores', expr='sad', bg='cell')),
        B('La sentencia se anula y Dolores sale de prisión a la espera de un nuevo juicio. Pero el daño ya está hecho.', S('object', kind='letter', msg='Sentencia anulada. Se ordena repetir el juicio.')),
        B('Agosto de 2003. En Coín, muy cerca de Mijas, desaparece otra chica: Sonia Carabantes.', S('map', lon=-4.76, lat=36.66, label='Coín, Málaga', year='2003'), chip='Agosto · 2003', heart=True),
        B('El ADN del asesino de Sonia se compara con las pruebas del caso Rocío.', S('object', kind='dna')),
        B('Y coincide. Con una colilla encontrada cerca del cuerpo de Rocío.', S('object', kind='cigarette', label='1'), hit=True),
        B('El asesino era Tony Alexander King, un británico que vivía en la zona.', S('char', who='king', expr='creepy', bg='police', push=0.12)),
        B('Muchos se preguntan: si se hubiera buscado bien desde el principio, ¿seguiría Sonia viva?', S('evidence', items=['Rocío 1999', 'Sonia 2003', 'ADN', 'Colilla', {'who': 'king', 'label': 'T. King'}])),
        B('¿Qué opinas tú? Te leo en comentarios.', S('eyes', who='dolores', stare=True)),
    ])

EVABLANCO = dict(
    id='09_caso_eva_blanco', title='18 años después: el ADN habló', voice=M,
    cast=dict(eva=dict(skin='#f0c4a0', hair='#3a2418', style='long', shirt='#7a5aa0', cheeks=True),
              guardia=dict(skin='#d9a07a', hair='#222', shirt='#2f5a3a', hat='tricornio'),
              ahmed=dict(skin='#c98b5f', hair='#1a1a1a', style='short', shirt='#4a4a4a', mustache=True)),
    beats=[
        B('Dieciocho años. Eso tardaron en encontrar al asesino de Eva. Y lo encontraron gracias al ADN de un familiar suyo.', S('stamp', text='18 AÑOS', sub='después'), hit=True),
        B('Abril de 1997. Algete, Madrid.', S('map', lon=-3.5, lat=40.6, label='Algete, Madrid', year='1997'), chip='Abril · 1997'),
        B('Eva Blanco tiene dieciséis años. Sale una noche con sus amigos.', S('char', who='eva', expr='smile', bg='street')),
        B('Vuelve a casa caminando. Nunca llega.', S('street', walker='eva', dir=1, follower=True), heart=True),
        B('A la mañana siguiente la encuentran sin vida junto a una carretera.', S('forest', seed=4), hit=True),
        B('El asesino ha dejado restos de ADN. Pero en 1997 no hay con quién compararlo.', S('object', kind='dna'), chip='ADN sin nombre'),
        B('El caso se queda congelado. Años. Más de una década.', S('evidence', items=['Algete', 'ADN', '?', '?', {'who': 'eva', 'label': 'Eva, 16'}], stamp='SIN RESOLVER')),
        B('Hasta que la Guardia Civil decide volver a analizar ese ADN con técnicas nuevas.', S('char', who='guardia', expr='neutral', bg='police')),
        B('El análisis revela algo clave: el posible origen geográfico del asesino.', S('map', lon=-3.5, lat=40.6, label='Algete', zoom=0.5)),
        B('Los agentes piden muestras de ADN, una a una, a vecinos de Algete.', S('object', kind='dna'), heart=True),
        B('Y uno de ellos tiene un ADN casi idéntico al del asesino. No era él... era un familiar.', S('stamp', text='99%', size=240, sub='coincidencia familiar'), hit=True),
        B('Octubre de 2015. Detienen en Francia a Ahmed Chelh. Dieciocho años después del crimen.', S('char', who='ahmed', expr='scared', bg='police'), chip='Octubre · 2015'),
        B('Un caso que demostró que, a veces, el tiempo no borra nada.', S('object', kind='clock', time=(4, 20))),
        B('¿Crees que todos los casos sin resolver podrían cerrarse así? Comenta.', S('eyes', who='eva', stare=True)),
    ])

JUBANY = dict(
    id='10_caso_helena_jubany', title='El misterio de Helena Jubany', voice=F,
    cast=dict(helena=dict(skin='#f0c8a8', hair='#5a3a22', style='long', shirt='#3a6a7a', glasses=True)),
    beats=[
        B('Alguien le dejó una bebida con somníferos en la puerta de su casa. Días después, la mataron. Y nadie ha pagado por ello.', S('object', kind='drink', label='ZUMO'), hit=True),
        B('Diciembre de 2001. Sabadell, Barcelona.', S('map', lon=2.11, lat=41.55, label='Sabadell', year='2001'), chip='Diciembre · 2001'),
        B('Helena Jubany, bibliotecaria de veintisiete años. Tranquila. Sin enemigos conocidos.', S('char', who='helena', expr='smile', bg='office')),
        B('Pero antes de morir empieza a recibir notas anónimas.', S('object', kind='letter', msg='Sabemos quién eres...'), heart=True),
        B('Y un día encuentra en su puerta una bebida. Más tarde se supo que contenía somníferos.', S('door', peep=False), chip='La bebida'),
        B('El 2 de diciembre, su cuerpo aparece en el patio de un edificio.', S('house', kind='block', seed=9), hit=True),
        B('La autopsia revela que había sido drogada y arrojada desde la azotea.', S('news', headline='Hallan muerta a una bibliotecaria en Sabadell', date='Diciembre · 2001', who='helena')),
        B('La investigación apunta a su entorno: un grupo excursionista al que se había unido hacía poco.', S('evidence', items=['Grupo', 'Notas', 'Bebida', 'Azotea', {'who': 'helena', 'label': 'Helena'}])),
        B('Varias personas son investigadas. Una de ellas muere en prisión antes del juicio.', S('char', who='helena', expr='sad', bg='cell', bars=True), heart=True),
        B('Las demás quedan libres. No hay pruebas suficientes.', S('court', judge=True, verdict='SIN PRUEBAS')),
        B('Más de veinte años después, el crimen de Helena Jubany sigue sin resolver.', S('evidence', items=['?', '?', '?', '?', {'who': 'helena', 'label': 'Helena, 27'}], stamp='SIN RESOLVER'), hit=True),
        B('Su familia sigue pidiendo lo mismo: saber la verdad.', S('char', who='helena', expr='neutral', bg='room')),
        B('¿Quién crees que dejó aquella bebida en su puerta? Comenta.', S('door', feet=True)),
    ])

REAL = [ARROPIERO, MATAVIEJAS, BARAJA, FERRANDIZ, ROMASANTA, ENRIQUETA, GALINDOS, WANNINKHOF, EVABLANCO, JUBANY]
