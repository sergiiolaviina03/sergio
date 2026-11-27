import type { Expense, HRDocument } from '../types'
import { sha256 } from '../lib/sha256'
import { EMPLOYEES, ME_ID, COMPANY } from './seed'
import { dayKey } from '../lib/time'
import { addDays, subMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'

const ALL = EMPLOYEES.map((e) => e.id)

const sig = (empId: string, ts: number, docHash: string) => {
  const e = EMPLOYEES.find((x) => x.id === empId)!
  // Firma tipográfica generada como SVG para los datos de ejemplo
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="90"><text x="10" y="62" font-family="Segoe Script, Brush Script MT, cursive" font-size="40" fill="#1e1b4b">${e.name}</text></svg>`
  const image = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
  return { empId, ts, image, method: 'typed' as const, readSeconds: 40 + ((ts / 1000) % 120), device: 'Aura web', hash: sha256(`${docHash}|${empId}|${ts}|${sha256(image)}`) }
}

function doc(d: Omit<HRDocument, 'hash' | 'signatures'>, signers: [string, number][] = []): HRDocument {
  const hash = sha256(d.title + '\n' + d.body)
  return { ...d, hash, signatures: signers.map(([e, ts]) => sig(e, ts, hash)) }
}

export function seedDocuments(now = new Date()): HRDocument[] {
  const t = now.getTime()
  const day = 864e5
  const prev = subMonths(now, 1)
  const prevName = format(prev, 'MMMM yyyy', { locale: es })
  return [
    doc(
      {
        id: 'd-geo',
        title: 'Política de registro de jornada y geolocalización',
        category: 'politica',
        mandatory: true,
        requireSignature: true,
        due: dayKey(addDays(now, 3)),
        audience: ALL,
        createdAt: t - 4 * day,
        createdBy: 'e9',
        body: `## 1. Objeto
${COMPANY.legal} registra diariamente la jornada de cada persona, con el inicio y el final de la jornada y las pausas, conforme al artículo 34.9 del Estatuto de los Trabajadores.

## 2. Cómo se ficha
El fichaje se realiza desde la app Aura (web o móvil) o desde el quiosco de cada oficina. Cada registro queda sellado criptográficamente y no puede modificarse; cualquier corrección se añade como un registro nuevo, aprobado por tu responsable y visible para ti.

## 3. Uso de la ubicación
Solo se consulta tu ubicación en el momento exacto de fichar, nunca de forma continua. Se usa para comprobar si estás en un centro de trabajo o en tu lugar de teletrabajo acordado. No se rastrea tu posición fuera de esos instantes.

## 4. Fotografía de verificación
Si la empresa activa la verificación con selfie, la foto se guarda en miniatura únicamente como prueba del fichaje y su huella forma parte del sello.

## 5. Tus derechos
Base jurídica: cumplimiento de una obligación legal (art. 6.1.c RGPD) y ejecución del contrato. Los registros se conservan 4 años. Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición y limitación escribiendo a People.

## 6. Aceptación
Con tu firma confirmas que has leído y entendido esta política.`,
      },
      [['e2', t - 3 * day], ['e3', t - 3 * day + 3600e3], ['e4', t - 2 * day], ['e6', t - 2 * day], ['e7', t - 3 * day], ['e9', t - 4 * day], ['e10', t - day]],
    ),
    doc(
      {
        id: 'd-desc',
        title: 'Protocolo de desconexión digital',
        category: 'politica',
        mandatory: true,
        requireSignature: true,
        due: dayKey(addDays(now, 10)),
        audience: ALL,
        createdAt: t - 2 * day,
        createdBy: 'e9',
        body: `## Derecho a desconectar
Conforme al artículo 88 de la LOPDGDD, nadie está obligado a responder mensajes, llamadas o correos fuera de su jornada, durante sus vacaciones o permisos.

## Buenas prácticas
- Programa los envíos fuera de horario para que lleguen al día siguiente.
- Evita convocar reuniones antes de las 9:00 o después de las 17:30.
- Aura silencia sus notificaciones fuera de tu horario.

## Excepciones
Solo en situaciones de fuerza mayor que puedan causar un perjuicio grave a la empresa o a sus clientes, comunicadas por tu responsable.`,
      },
      [['e2', t - day], ['e9', t - 2 * day]],
    ),
    doc(
      {
        id: 'd-reg',
        title: `Registro de jornada · ${prevName}`,
        category: 'registro',
        mandatory: true,
        requireSignature: true,
        due: dayKey(addDays(now, 5)),
        audience: ALL,
        createdAt: t - day,
        createdBy: 'e9',
        body: `## Resumen mensual
Este documento recoge tu registro diario de jornada de ${prevName}: horas de entrada, salida y pausas, tal como constan en el registro sellado de Aura.

## Conformidad
Al firmarlo confirmas que el registro refleja tu jornada real. Si detectas algún error, solicita una corrección antes de firmar desde «Hoja de horas».

## Conservación
La empresa conserva este registro durante cuatro años a disposición de la persona trabajadora, de sus representantes y de la Inspección de Trabajo.`,
      },
      [['e3', t - 20 * 3600e3], ['e7', t - 10 * 3600e3]],
    ),
    doc(
      {
        id: 'd-tele',
        title: 'Anexo de teletrabajo 2026',
        category: 'anexo',
        mandatory: false,
        requireSignature: true,
        audience: ['e1', 'e3', 'e4', 'e8', 'e11'],
        createdAt: t - 60 * day,
        createdBy: 'e9',
        body: `## Acuerdo
Se acuerda un régimen de teletrabajo parcial en los días indicados en tu ficha, conforme a la Ley 10/2021 de trabajo a distancia.

## Compensación de gastos
La empresa abona 35 € mensuales por los gastos de conexión y suministros.

## Equipos
La empresa facilita portátil, monitor y silla ergonómica.`,
      },
      [['e1', t - 58 * day], ['e3', t - 57 * day], ['e4', t - 55 * day], ['e8', t - 56 * day]],
    ),
    doc(
      {
        id: 'd-contract-e1',
        title: 'Contrato de trabajo indefinido',
        category: 'contrato',
        mandatory: false,
        requireSignature: true,
        audience: [ME_ID],
        createdAt: new Date(2021, 1, 20).getTime(),
        createdBy: 'e9',
        attachment: { name: 'contrato-indefinido.pdf', size: 248_311, hash: sha256('contrato-e1') },
        body: `## Partes
${COMPANY.legal}, con CIF ${COMPANY.cif}, y la persona trabajadora firmante.

## Condiciones
Contrato indefinido a jornada completa (40 h semanales), grupo profesional 1, con periodo de prueba de seis meses.`,
      },
      [[ME_ID, new Date(2021, 1, 22).getTime()]],
    ),
  ]
}

export function seedExpenses(now = new Date()): Expense[] {
  const t = now.getTime()
  const d = (n: number) => dayKey(addDays(now, -n))
  return [
    { id: 'x1', empId: ME_ID, date: d(3), merchant: 'Restaurante La Clave', amount: 48.6, vat: 4.42, category: 'comida', note: 'Comida con cliente (Grupo Orión)', status: 'pending', createdAt: t - 3 * 864e5, flags: [] },
    { id: 'x2', empId: ME_ID, date: d(9), merchant: 'Renfe', amount: 72.3, vat: 6.57, category: 'transporte', note: 'AVE Madrid–Barcelona', status: 'approved', createdAt: t - 9 * 864e5, flags: [] },
    { id: 'x3', empId: ME_ID, date: d(9), merchant: 'Hotel Casa Fuster', amount: 189, vat: 17.18, category: 'alojamiento', status: 'paid', createdAt: t - 9 * 864e5, flags: [] },
    { id: 'x4', empId: ME_ID, date: d(15), merchant: 'Figma', amount: 54.45, vat: 9.45, category: 'software', status: 'paid', createdAt: t - 15 * 864e5, flags: [] },
    { id: 'x5', empId: 'e2', date: d(2), merchant: 'Cabify', amount: 23.9, vat: 2.17, category: 'transporte', note: 'Visita a cliente', status: 'pending', createdAt: t - 2 * 864e5, flags: [] },
    { id: 'x6', empId: 'e8', date: d(4), merchant: 'Kilometraje', amount: 62.4, km: 240, category: 'kilometraje', note: 'Barcelona → Girona → Barcelona', status: 'pending', createdAt: t - 4 * 864e5, flags: [] },
  ]
}
