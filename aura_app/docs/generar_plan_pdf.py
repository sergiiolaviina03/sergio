from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

F = '/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('Sans', F + 'DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('Sans-B', F + 'DejaVuSans-Bold.ttf'))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily('Sans', normal='Sans', bold='Sans-B', italic='Sans', boldItalic='Sans-B')

BRAND = colors.HexColor('#635BFF'); INK = colors.HexColor('#161623'); MUTED = colors.HexColor('#6E6E82')
LINE = colors.HexColor('#E6E6EE'); SOFT = colors.HexColor('#F4F3FF'); OK = colors.HexColor('#0E9F6E')

S = lambda name, **kw: ParagraphStyle(name, fontName=kw.pop('font', 'Sans'), textColor=kw.pop('color', INK), **kw)
h1 = S('h1', font='Sans-B', fontSize=22, leading=27, spaceAfter=4)
sub = S('sub', fontSize=10.5, leading=15, color=MUTED, spaceAfter=14)
h2 = S('h2', font='Sans-B', fontSize=14, leading=18, spaceBefore=14, spaceAfter=7, color=BRAND)
body = S('b', fontSize=9.6, leading=14.2, spaceAfter=6)
small = S('s', fontSize=8.2, leading=11.5, color=MUTED)
cell = S('c', fontSize=8.8, leading=12)
cellb = S('cb', font='Sans-B', fontSize=8.8, leading=12)
cellh = S('ch', font='Sans-B', fontSize=8.6, leading=11.5, color=colors.white)
big = S('big', font='Sans-B', fontSize=21, leading=25, color=BRAND)
bigl = S('bigl', fontSize=9, leading=12, color=MUTED)

def P(t, st=body): return Paragraph(t, st)

def table(rows, widths, bold_last=False, zebra=True):
    data = [[P(c, cellh) for c in rows[0]]] + [[P(str(c), cellb if (bold_last and i == len(rows) - 2) else cell) for c in r] for i, r in enumerate(rows[1:])]
    t = Table(data, colWidths=widths, repeatRows=1)
    st = [('BACKGROUND', (0, 0), (-1, 0), BRAND), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
          ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5), ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
          ('LINEBELOW', (0, 1), (-1, -1), 0.4, LINE)]
    if zebra:
        for i in range(1, len(data)):
            if i % 2 == 0: st.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#FAFAFD')))
    if bold_last: st.append(('BACKGROUND', (0, len(data) - 1), (-1, len(data) - 1), SOFT))
    t.setStyle(TableStyle(st))
    return t

def kpis(items):
    t = Table([[P(v, big) for v, _ in items], [P(l, bigl) for _, l in items]], colWidths=[170 / len(items) * mm] * len(items))
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), SOFT), ('TOPPADDING', (0, 0), (-1, 0), 12), ('BOTTOMPADDING', (0, 1), (-1, 1), 12), ('LEFTPADDING', (0, 0), (-1, -1), 12), ('LINEAFTER', (0, 0), (-2, -1), 0.6, colors.white)]))
    return t

def footer(c, d):
    c.saveState()
    c.setFont('Sans', 7.5); c.setFillColor(MUTED)
    c.drawString(20 * mm, 12 * mm, 'Aura · Plan de lanzamiento y precios · noviembre de 2026')
    c.drawRightString(190 * mm, 12 * mm, f'{d.page}')
    c.setFillColor(BRAND); c.roundRect(20 * mm, 281 * mm, 7 * mm, 7 * mm, 1.8 * mm, fill=1, stroke=0)
    c.setStrokeColor(colors.white); c.setLineWidth(1.6); c.circle(23.5 * mm, 284.5 * mm, 1.8 * mm)
    c.setFillColor(INK); c.setFont('Sans-B', 10); c.drawString(29.5 * mm, 283 * mm, 'Aura')
    c.restoreState()

out = '/home/user/sergio/aura_app/docs/Aura-plan-y-precios.pdf'
doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=24 * mm, bottomMargin=20 * mm, title='Aura · Plan y precios', author='Aura')
W = 170 * mm
s = []
s += [P('Aura: plan de lanzamiento, costes y precios', h1),
      P('Cuánto cuesta tener Aura funcionando (web, portal para empresas, app de Android y app de iPhone), cuánto cobrar y cómo salir a vender en dos semanas. Precios consultados en noviembre de 2026; las cifras en dólares se convierten a euros de forma aproximada.', sub)]
s += [kpis([('≈ 410 €', 'tecnología el primer año<br/>(≈ 34 € al mes)'), ('≈ 23 €/mes', 'coste fijo mensual<br/>para empezar'), ('1 cliente', 'de 12 personas (plan Completo)<br/>cubre todos los costes')]), Spacer(1, 10)]

s += [P('1. Coste para tenerlo todo funcionando', h2),
      P('Incluye la web pública, el portal donde las empresas entran y fichan, el servidor con la base de datos y los archivos, y la publicación en Google Play y en el App Store.')]
s += [table([
    ['Concepto', 'Para qué sirve', 'Coste', 'Frecuencia'],
    ['Supabase Pro', 'Servidor: cuentas, base de datos, registro sellado, documentos, tiempo real, copias diarias', '25 USD (≈ 23 €)', 'al mes'],
    ['Cloudflare Pages', 'Alojar la web y el portal de Aura con tu dominio y HTTPS', '0 €', '—'],
    ['Dominio (.es o .com)', 'Tu dirección, p. ej. aurafichaje.es', '10–15 €', 'al año'],
    ['Apple Developer Program', 'Publicar la app en el App Store y TestFlight', '99 €', 'al año'],
    ['Google Play Console', 'Publicar la app en Google Play', '25 USD (≈ 23 €)', 'una vez'],
    ['Email de la app (Resend o Brevo)', 'Confirmar cuentas, recuperar contraseñas, avisos', '0 € (hasta ~3.000 correos/mes)', 'al mes'],
    ['Compilación de las apps (GitHub Actions)', 'Genera la app de Android y la de iPhone en cada cambio', '0 € (repositorio público)', '—'],
    ['Total año 1', '', '≈ 410 €', '≈ 34 € al mes de media'],
], [38 * mm, 70 * mm, 34 * mm, 28 * mm], bold_last=True)]
s += [Spacer(1, 6), P('<b>Aparte, no tecnológico y recomendable antes de cobrar:</b> alta como autónomo o S.L.; textos legales (aviso legal, privacidad, condiciones del servicio y contrato de encargado del tratamiento con cada cliente): 300–800 € una vez con un abogado; seguro de responsabilidad civil y ciberriesgos: unos 200–400 € al año (orientativo).'),
      P('<b>Comisiones de las tiendas:</b> si las empresas contratan y pagan en tu web y la app solo sirve para entrar y fichar, ni Apple ni Google cobran comisión. Solo la cobrarían si vendieras suscripciones dentro de la app.', body),
      P('<b>Cobros a clientes (Stripe):</b> en torno al 1,5 % + 0,25 € por cobro con tarjeta europea; la domiciliación SEPA es más barata. Con una cuota de 54 € al mes, son unos 1,06 € por cliente y mes.', body)]

s += [P('2. Cómo crece el coste con los clientes', h2)]
s += [table([
    ['Escala', 'Servidor', 'Email', 'Coste mensual aprox.'],
    ['Hasta 30 empresas (~500 personas)', 'Supabase Pro con la instancia incluida', 'Plan gratuito', '≈ 23 €'],
    ['Hasta 100 empresas (~1.500 personas)', 'Supabase Pro + instancia mayor', 'Plan de pago (≈ 20 USD)', '≈ 60–80 €'],
    ['Hasta 300 empresas (~5.000 personas)', 'Supabase Pro + instancia mediana', 'Plan de pago', '≈ 120–180 €'],
], [52 * mm, 50 * mm, 34 * mm, 34 * mm])]
s += [Spacer(1, 4), P('Estimación: la necesidad real de servidor depende del uso. Supabase es de código abierto, así que a gran escala también se puede alojar en un servidor propio.', small)]

s += [P('3. Qué cobra la competencia', h2)]
s += [table([
    ['Producto', 'Precio publicado', 'Condiciones'],
    ['Sesame HR (Essential)', '4,75 €/empleado/mes', 'Facturación anual, mínimo 15 empleados'],
    ['Factorial', 'Desde 5,50 €/persona/mes', 'Módulos adicionales con coste aparte'],
    ['Woffu (Lite)', 'Desde 1,50 €/usuario/mes', 'Solo hasta 10 empleados; después, precio a medida'],
], [45 * mm, 45 * mm, 80 * mm])]

s += [P('4. Precios que podemos poner', h2),
      P('Tres opciones según cómo quieras posicionarte. <b>Recomendada: la B</b>, por debajo de Sesame y Factorial, sin mínimos de 15 personas y con migración gratis.')]
s += [table([
    ['Opción', 'Plan Fichaje', 'Plan Completo', 'Para quién'],
    ['A · Agresiva', '1,90 €/emp./mes (mín. 15 €)', '3,50 €/emp./mes (mín. 29 €)', 'Captar rápido a pequeños comercios'],
    ['B · Recomendada', '2,50 €/emp./mes (mín. 19 €)', '4,50 €/emp./mes (mín. 35 €)', 'Pymes de 5 a 100 personas'],
    ['C · Premium', '3,50 €/emp./mes (mín. 29 €)', '5,90 €/emp./mes (mín. 49 €)', 'Con soporte por teléfono y alta hecha por ti'],
], [32 * mm, 45 * mm, 45 * mm, 48 * mm])]
s += [Spacer(1, 6), table([
    ['Plan', 'Incluye'],
    ['Fichaje', 'Fichaje por app de iPhone y Android, web y QR del quiosco; geolocalización y antifraude; registro sellado e inalterable; hoja de horas; ausencias y vacaciones; exportación para la Inspección de Trabajo'],
    ['Completo', 'Todo lo anterior + documentos con firma electrónica, gastos con lectura de tickets, turnos, previsión de nómina, organigrama, copiloto e importación desde otras herramientas'],
    ['Empresa', 'A partir de 50 personas: precio a medida, servidor dedicado o propio y soporte prioritario'],
], [28 * mm, 142 * mm])]
s += [Spacer(1, 6), P('<b>Condiciones para cerrar ventas:</b> 30 días gratis sin tarjeta · sin permanencia · pago anual con 2 meses gratis · migración desde Factorial, Sesame, Woffu, A3 o Excel incluida · oferta de lanzamiento: un 30 % de descuento de por vida para los 20 primeros clientes · 20 % recurrente para las asesorías laborales que traigan clientes.')]

sec5 = [P('5. Cuánto se puede ganar (opción B)', h2), P('Supuesto: empresas de 15 personas de media y un 60 % en el plan Completo, unos 3,70 € por persona: ≈ 56 € por empresa al mes.'),
  table([
    ['Clientes', 'Ingresos al mes', 'Costes al mes (tecnología + Stripe)', 'Margen al mes', 'Ingresos al año'],
    ['5', '≈ 280 €', '≈ 30 €', '≈ 250 €', '≈ 3.360 €'],
    ['20', '≈ 1.120 €', '≈ 50 €', '≈ 1.070 €', '≈ 13.440 €'],
    ['50', '≈ 2.800 €', '≈ 120 €', '≈ 2.680 €', '≈ 33.600 €'],
    ['150', '≈ 8.400 €', '≈ 300 €', '≈ 8.100 €', '≈ 100.800 €'],
  ], [22 * mm, 30 * mm, 50 * mm, 32 * mm, 36 * mm]), Spacer(1, 4),
  P('Antes de impuestos, cuota de autónomo, comisiones a asesorías y marketing. El margen de la tecnología es muy alto porque el coste crece mucho más despacio que los ingresos.', small)]
s += [KeepTogether(sec5)]

s += [P('6. Plan para empezar a vender en 2 semanas', h2)]
s += [table([
    ['Días', 'Qué', 'Quién'],
    ['1', 'Crear las cuentas: Supabase Pro, dominio, Cloudflare, Apple Developer (mejor como empresa, con número D-U-N-S gratuito), Google Play Console (de organización) y Stripe', 'Tú'],
    ['1–2', 'Conectar el servidor y publicar Aura en tu dominio; configurar las claves de Apple y Google en GitHub para que las apps se firmen y suban solas', 'Tú me pasas los datos; lo dejo funcionando'],
    ['2–3', 'Textos legales y política de privacidad (necesaria también para las tiendas); fichas de Google Play y del App Store con capturas', 'Tú + yo'],
    ['3–5', 'Piloto con 1 o 2 empresas conocidas: migración de sus datos, alta de su plantilla y una semana fichando con la app', 'Tú, con mi apoyo'],
    ['5–7', 'Enviar las apps a revisión: Apple suele tardar de 1 a 3 días y Google unos días (las cuentas personales nuevas de Google exigen antes 14 días de pruebas con 12 personas; las de organización, no)', 'Tú'],
    ['6–9', 'Web comercial con precios y alta autónoma con prueba gratis, cobros con Stripe, festivos por comunidad autónoma y avisos por email', 'Yo'],
    ['10', 'Lanzamiento: asesorías laborales de tu zona, LinkedIn, comercios y hostelería cercanos, y los clientes del piloto como referencia', 'Tú'],
], [16 * mm, 112 * mm, 42 * mm])]

li = S('li', fontSize=9.6, leading=14, leftIndent=12, firstLineIndent=-9, spaceAfter=3)
s += [P('7. Qué hay ya hecho', h2)] + [P('• ' + x, li) for x in ['Web y portal funcionando (versión de demostración publicada).', 'App de Android que se compila y publica sola.', 'App de iPhone que se compila sola y se sube a TestFlight en cuanto estén las claves de Apple.', 'Servidor con cuentas, empresas, roles, invitaciones y registro sellado, probado.', 'Migración desde otras herramientas.', 'Documentos con firma, gastos, turnos, ausencias, previsión de nómina y QR de quiosco.']]

s += [P('8. Riesgos que conviene tener claros', h2)] + [P('• ' + x, li) for x in [
  '<b>Nómina:</b> es una previsión; véndela como «prenómina» y exportación para la asesoría, no como nómina oficial.',
  '<b>Registro de jornada digital:</b> el reglamento estaba pendiente de publicarse en el BOE; cuando salga habrá que ajustar formatos y el acceso de la Inspección.',
  '<b>Protección de datos:</b> la ubicación y la imagen son datos personales de la plantilla; cada cliente debe informar a sus empleados y firmar contigo el contrato de encargado del tratamiento.',
  '<b>Mapas:</b> los mapas gratuitos de OpenStreetMap no admiten uso comercial intensivo; con muchos clientes habrá que contratar un proveedor o alojarlos (0–25 €/mes).']]
s += [Spacer(1, 8), P('Fuentes: supabase.com/pricing · developer.apple.com/programs · play.google.com/console · stripe.com/es/pricing · comparativas de precios de Factorial, Turnozo y Rankia (2026). Verifica las tarifas al contratar.', small)]

doc.build(s, onFirstPage=footer, onLaterPages=footer)
print(out)
