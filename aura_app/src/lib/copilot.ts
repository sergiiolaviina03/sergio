// Copiloto: intérprete de lenguaje natural en español 100% local (sin servicios externos, sin coste).
// Entiende intenciones de RR. HH. y fechas relativas («el viernes», «del 22 al 26 de diciembre», «la semana que viene»…).
import type { PunchType } from '../types'
import { addDays, startOfWeek } from 'date-fns'
import { dayKey } from './time'

export type Page = 'home' | 'clock' | 'timesheet' | 'timeoff' | 'payroll' | 'team' | 'inbox' | 'ledger' | 'settings' | 'kiosk'

export type Intent =
  | { kind: 'clock'; type: PunchType }
  | { kind: 'hours'; range: 'today' | 'week' | 'month' }
  | { kind: 'bank' }
  | { kind: 'leave_balance'; typeId?: string }
  | { kind: 'leave_request'; typeId: string; from: string; to: string; hours?: number }
  | { kind: 'payroll'; salary?: number; raise?: number }
  | { kind: 'who'; what: 'in' | 'remote' | 'off' | 'out' }
  | { kind: 'nav'; page: Page }
  | { kind: 'issues' }
  | { kind: 'theme'; value: 'dark' | 'light' }
  | { kind: 'verify' }
  | { kind: 'leave_time'; }
  | { kind: 'help' }
  | { kind: 'unknown' }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,]/g, ' ').replace(/\s+/g, ' ').trim()
const has = (t: string, ...w: (string | RegExp)[]) => w.some((x) => (typeof x === 'string' ? t.includes(x) : x.test(t)))

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DOWS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function nextDow(now: Date, dow: number, forceNext = false) {
  let diff = (dow - now.getDay() + 7) % 7
  if (diff === 0) diff = 7
  if (forceNext && diff <= 1) diff += 7 // «el sábado que viene» dicho un viernes = la semana siguiente
  return addDays(now, diff)
}

function mkDate(now: Date, day: number, month?: number) {
  let y = now.getFullYear()
  const m = month ?? now.getMonth()
  const d = new Date(y, m, day)
  if (d < addDays(now, -1) && month !== undefined) d.setFullYear(++y)
  else if (d < addDays(now, -1)) d.setMonth(d.getMonth() + 1)
  return d
}

/** Devuelve [desde, hasta] o null. */
export function parseDates(raw: string, now = new Date()): [Date, Date] | null {
  const t = norm(raw)
  const mi = (s?: string) => (s ? MONTHS.findIndex((m) => s.startsWith(m.slice(0, 3))) : -1)
  // del 22 al 26 de diciembre | del 3 de dic al 7 de ene
  let m = t.match(/(?:del|desde el|de) (\d{1,2})(?: de (\w+))? (?:al|hasta el|a) (\d{1,2})(?: de (\w+))?/)
  if (m) {
    const m2 = mi(m[4])
    const m1 = m[2] ? mi(m[2]) : m2
    const a = mkDate(now, +m[1], m1 >= 0 ? m1 : undefined)
    const b = mkDate(now, +m[3], m2 >= 0 ? m2 : m1 >= 0 ? m1 : undefined)
    if (b < a) b.setFullYear(b.getFullYear() + 1)
    return [a, b]
  }
  // 22/12 - 26/12
  m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?(?: (?:-|al|a|hasta) (\d{1,2})\/(\d{1,2}))?/)
  if (m) {
    const a = mkDate(now, +m[1], +m[2] - 1)
    const b = m[3] ? mkDate(now, +m[3], +m[4] - 1) : a
    return [a, b]
  }
  if (has(t, 'semana que viene', 'proxima semana', 'siguiente semana')) {
    const s = startOfWeek(addDays(now, 7), { weekStartsOn: 1 })
    return [s, addDays(s, 4)]
  }
  if (has(t, 'pasado manana')) return [addDays(now, 2), addDays(now, 2)]
  if (has(t, 'manana')) return [addDays(now, 1), addDays(now, 1)]
  if (has(t, /\bhoy\b/)) return [now, now]
  // el 3 de diciembre
  m = t.match(/(?:el )?(\d{1,2}) de (\w+)/)
  if (m && mi(m[2]) >= 0) {
    const a = mkDate(now, +m[1], mi(m[2]))
    return [a, a]
  }
  // el viernes / el lunes que viene / del lunes al miercoles
  m = t.match(/(?:del|de) (lunes|martes|miercoles|jueves|viernes) (?:al|a) (lunes|martes|miercoles|jueves|viernes)/)
  if (m) {
    const a = nextDow(now, DOWS.indexOf(m[1]))
    let b = nextDow(a, DOWS.indexOf(m[2]))
    if (DOWS.indexOf(m[2]) === a.getDay()) b = a
    return [a, b]
  }
  for (let i = 1; i <= 6; i++) {
    if (new RegExp(`\\b${DOWS[i]}\\b`).test(t)) {
      const d = nextDow(now, i, has(t, 'que viene', 'proximo'))
      return [d, d]
    }
  }
  m = t.match(/\bel (\d{1,2})\b/)
  if (m) {
    const a = mkDate(now, +m[1])
    return [a, a]
  }
  return null
}

function money(t: string): number | undefined {
  const m = t.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|mil)?\s*(?:€|euros|eur|brutos|bruto)?/)
  if (!m) return
  let n = parseFloat(m[1].replace(/[.\s](?=\d{3}\b)/g, '').replace(',', '.'))
  if (m[2]) n *= 1000
  return n
}

export function parse(raw: string, now = new Date()): Intent {
  const t = norm(raw)
  if (!t) return { kind: 'help' }
  if (has(t, 'modo oscuro', 'tema oscuro', 'dark')) return { kind: 'theme', value: 'dark' }
  if (has(t, 'modo claro', 'tema claro', 'light')) return { kind: 'theme', value: 'light' }
  if (has(t, 'verifica', 'integridad', 'auditor', 'inspeccion', 'sellad')) return { kind: 'verify' }

  // Ausencias: petición
  const leaveType = has(t, 'asunto', 'propio') ? 'own' : has(t, 'medico', 'cita', 'dentista') ? 'med' : has(t, 'baja', 'enferm', 'malo', 'mala') ? 'sick' : has(t, 'teletrabajo', 'desde casa', 'remoto') ? 'remote' : has(t, 'vacacion', 'libre', 'dia off', 'puente', 'fiesta') ? 'vac' : null
  const wantsRequest = has(t, 'pide', 'pideme', 'pedir', 'solicita', 'reserva', 'quiero', 'cojo', 'cogerme', 'coger', 'me voy', 'necesito', 'tomar', 'agenda', 'me cojo', 'pon ', 'estoy')
  const dates = parseDates(raw, now)
  const isQuestion = has(t, 'cuant', 'quedan', 'saldo', 'me queda', 'disponible', 'quien')
  if (leaveType && dates && (wantsRequest || !isQuestion)) {
    const hm = t.match(/(\d+(?:[.,]\d)?)\s*(?:h\b|horas?)/)
    return { kind: 'leave_request', typeId: leaveType, from: dayKey(dates[0]), to: dayKey(dates[1]), hours: leaveType === 'med' ? (hm ? parseFloat(hm[1].replace(',', '.')) : 2) : undefined }
  }
  if (leaveType && has(t, 'cuant', 'quedan', 'tengo', 'saldo', 'me queda', 'disponible')) return { kind: 'leave_balance', typeId: leaveType }

  // Fichaje
  if (has(t, /\b(pausa|descanso|cafe|comer|almorzar|almuerzo)\b/) && !has(t, 'cuant')) return { kind: 'clock', type: has(t, 'vuelvo', 'termina', 'fin', 'acabo', 'reanuda') ? 'break_end' : 'break_start' }
  if (has(t, 'vuelvo', 'reanuda', 'sigo', 'continu')) return { kind: 'clock', type: 'break_end' }
  if (has(t, /\b(ficha(r|me)? (la )?salida|me voy|salgo|termino|acabo|fin de jornada|ficha(me)? fuera|cierra (la )?jornada)\b/)) return { kind: 'clock', type: 'out' }
  if (has(t, /\b(ficha(r|me)?|entro|empiezo|entrada|comienza|inicia|llegue|he llegado)\b/) && !has(t, 'cuant', 'fichajes')) return { kind: 'clock', type: 'in' }

  if (has(t, 'nomina', 'cobr', 'sueldo', 'salario', 'neto', 'irpf', 'subida', 'suben', 'aumento', 'coste empresa')) {
    const n = money(t.replace(/\b(19|20)\d{2}\b/, ''))
    if (has(t, 'subida', 'suben', 'aumento', 'mas')) return { kind: 'payroll', raise: n }
    return { kind: 'payroll', salary: n && n > 3000 ? n : undefined }
  }
  if (has(t, 'a que hora', 'cuando puedo', 'hora de salida', 'cuando salgo', 'cuando me voy')) return { kind: 'leave_time' }
  if (has(t, 'banco', 'balance', 'debo horas', 'me deben', 'saldo de horas', 'horas extra')) return { kind: 'bank' }
  if (has(t, 'cuant', 'llevo', 'horas', 'trabajad')) {
    return { kind: 'hours', range: has(t, 'mes') ? 'month' : has(t, 'semana') ? 'week' : 'today' }
  }

  if (has(t, 'quien', 'quienes', 'esta', 'estan', 'equipo', 'gente')) {
    if (has(t, 'casa', 'remoto', 'teletrabaj')) return { kind: 'who', what: 'remote' }
    if (has(t, 'falta', 'ausente', 'vacacion', 'fuera', 'no ha')) return { kind: 'who', what: 'off' }
    return { kind: 'who', what: 'in' }
  }
  if (has(t, 'pendiente', 'revisa', 'error', 'olvid', 'inconsisten', 'problema', 'algo mal')) return { kind: 'issues' }

  const nav: [string[], Page][] = [
    [['inicio', 'home'], 'home'], [['jornada', 'reloj', 'mapa de fichaje'], 'clock'], [['hoja', 'registro horario', 'fichajes'], 'timesheet'],
    [['ausencia', 'vacacion', 'calendario'], 'timeoff'], [['nomina'], 'payroll'], [['equipo', 'mapa'], 'team'], [['bandeja', 'aprobacion', 'aprobar'], 'inbox'],
    [['libro', 'registro sellado', 'cadena'], 'ledger'], [['ajuste', 'config', 'zona', 'geovalla'], 'settings'], [['quiosco', 'kiosko', 'tablet'], 'kiosk'],
  ]
  for (const [ws, p] of nav) if (has(t, ...ws)) return { kind: 'nav', page: p }
  if (leaveType) return { kind: 'leave_balance', typeId: leaveType }
  if (has(t, 'ayuda', 'que puedes', 'que sabes', 'hola')) return { kind: 'help' }
  return { kind: 'unknown' }
}

export const SUGGESTIONS = [
  'Ficha mi entrada',
  '¿A qué hora puedo irme hoy?',
  'Pide vacaciones del 22 al 26 de diciembre',
  '¿Cuántos días de vacaciones me quedan?',
  '¿Tengo algo mal en mis fichajes?',
  '¿Cuánto cobraría con una subida de 3.000 €?',
  '¿Quién está teletrabajando?',
  'Verifica la integridad del registro',
]
