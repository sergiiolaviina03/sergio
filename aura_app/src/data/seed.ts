import type { Employee, Punch, TimeOffRequest, TimeOffType, Zone, Correction, Period, Notice } from '../types'
import { mulberry32 } from '../lib/rng'
import { jitter } from '../lib/geo'
import { atMin, dayKey, isoDow, monthKey, parseDay, toMin } from '../lib/time'
import { sealChain } from '../lib/ledger'
import { addDays, startOfMonth, subMonths } from 'date-fns'

// Empresa ficticia de demostración. Ningún dato real.
export const COMPANY = { name: 'Nébula Labs', legal: 'Nébula Labs S.L.', cif: 'B00000000', ccc: '28/0000000/00' }

export const ZONES: Zone[] = [
  { id: 'mad', name: 'Madrid · Castellana', address: 'Paseo de la Castellana 81, Madrid', lat: 40.4469, lng: -3.6919, radius: 120, color: '#6366f1' },
  { id: 'bcn', name: 'Barcelona · 22@', address: 'Carrer de Pere IV 51, Barcelona', lat: 41.4005, lng: 2.1952, radius: 150, color: '#06b6d4' },
  { id: 'vlc', name: 'Valencia · Ruzafa', address: 'Carrer de Sueca 30, Valencia', lat: 39.4627, lng: -0.3747, radius: 100, color: '#a855f7' },
]

export const TIME_OFF_TYPES: TimeOffType[] = [
  { id: 'vac', name: 'Vacaciones', unit: 'días', allowance: 23, color: '#6366f1', emoji: '🌴', paid: true },
  { id: 'own', name: 'Asuntos propios', unit: 'días', allowance: 2, color: '#a855f7', emoji: '✨', paid: true },
  { id: 'med', name: 'Médico', unit: 'horas', allowance: 20, color: '#06b6d4', emoji: '🩺', paid: true },
  { id: 'sick', name: 'Baja médica', unit: 'días', allowance: null, color: '#f43f5e', emoji: '🤒', paid: true },
  { id: 'remote', name: 'Teletrabajo extra', unit: 'días', allowance: 12, color: '#10b981', emoji: '🏡', paid: true },
]

// Festivos nacionales + Comunidad de Madrid (aprox.). Configurables por centro en una versión con backend.
export const HOLIDAYS: Record<string, string> = {
  '2026-01-01': 'Año Nuevo', '2026-01-06': 'Reyes', '2026-04-02': 'Jueves Santo', '2026-04-03': 'Viernes Santo',
  '2026-05-01': 'Día del Trabajo', '2026-05-15': 'San Isidro', '2026-08-15': 'Asunción', '2026-10-12': 'Fiesta Nacional',
  '2026-11-02': 'Todos los Santos (trasladado)', '2026-11-09': 'Almudena', '2026-12-07': 'Constitución (trasladado)',
  '2026-12-08': 'Inmaculada', '2026-12-25': 'Navidad',
  '2027-01-01': 'Año Nuevo', '2027-01-06': 'Reyes', '2027-03-25': 'Jueves Santo', '2027-03-26': 'Viernes Santo',
  '2027-05-01': 'Día del Trabajo', '2027-10-12': 'Fiesta Nacional', '2027-11-01': 'Todos los Santos',
  '2027-11-09': 'Almudena', '2027-12-06': 'Constitución', '2027-12-08': 'Inmaculada', '2027-12-25': 'Navidad',
}

const E = (o: Partial<Employee> & Pick<Employee, 'id' | 'name' | 'role' | 'team' | 'zoneId' | 'salary'>): Employee => ({
  hue: 250, pagas: 14, contract: 'indefinido', weeklyHours: 40, start: '09:00', end: '18:00', breakMin: 60, remoteDays: [], pin: '0000',
  birthday: '01-01', hiredAt: '2022-01-10', children: 0, ...o,
})

export const EMPLOYEES: Employee[] = [
  E({ id: 'e1', name: 'Lucía Navarro', role: 'Head of Product', team: 'Producto', zoneId: 'mad', salary: 58000, hue: 262, remoteDays: [5], pin: '1111', birthday: '12-04', hiredAt: '2021-03-01', children: 1 }),
  E({ id: 'e2', name: 'Diego Ferrer', role: 'Product Designer', team: 'Producto', managerId: 'e1', zoneId: 'mad', salary: 38000, hue: 200, start: '08:30', end: '17:30', remoteDays: [3], pin: '2222', birthday: '11-29' }),
  E({ id: 'e3', name: 'Marta Ibáñez', role: 'Frontend Engineer', team: 'Producto', managerId: 'e1', zoneId: 'mad', salary: 44000, hue: 330, start: '09:30', end: '18:30', remoteDays: [1, 5], pin: '3333', birthday: '03-15' }),
  E({ id: 'e4', name: 'Pau Soler', role: 'Backend Engineer', team: 'Producto', managerId: 'e1', zoneId: 'bcn', salary: 46000, hue: 160, remoteDays: [2, 4], pin: '4444', birthday: '07-21' }),
  E({ id: 'e5', name: 'Aitana Ruiz', role: 'UX Researcher', team: 'Producto', managerId: 'e1', zoneId: 'vlc', salary: 36000, hue: 20, start: '08:00', end: '16:00', breakMin: 30, weeklyHours: 37.5, pin: '5555', birthday: '12-02', contract: 'temporal' }),
  E({ id: 'e6', name: 'Javier Montes', role: 'Data Analyst', team: 'Producto', managerId: 'e1', zoneId: 'mad', salary: 41000, hue: 40, pin: '6666', birthday: '09-09' }),
  E({ id: 'e7', name: 'Nerea Castro', role: 'Customer Success', team: 'Clientes', managerId: 'e1', zoneId: 'mad', salary: 32000, hue: 300, start: '08:00', end: '17:00', pin: '7777', birthday: '05-30' }),
  E({ id: 'e8', name: 'Óscar Vidal', role: 'Account Executive', team: 'Clientes', managerId: 'e1', zoneId: 'bcn', salary: 39000, hue: 100, remoteDays: [5], pin: '8888', birthday: '02-11' }),
  E({ id: 'e9', name: 'Carla Molina', role: 'People Partner', team: 'Personas', managerId: 'e1', zoneId: 'mad', salary: 40000, hue: 350, pin: '9999', birthday: '10-18', children: 2 }),
  E({ id: 'e10', name: 'Hugo Prieto', role: 'QA Engineer', team: 'Producto', managerId: 'e1', zoneId: 'vlc', salary: 35000, hue: 180, start: '07:30', end: '15:30', breakMin: 30, weeklyHours: 37.5, pin: '1010', birthday: '06-06' }),
  E({ id: 'e11', name: 'Irene Salas', role: 'Marketing Lead', team: 'Clientes', managerId: 'e1', zoneId: 'mad', salary: 47000, hue: 280, remoteDays: [2], pin: '1212', birthday: '01-27' }),
]

export const ME_ID = 'e1'

type Seed = { punches: Punch[]; requests: TimeOffRequest[]; corrections: Correction[]; periods: Period[]; notices: Notice[]; seededThrough: string }

const rel = (base: Date, d: number) => dayKey(addDays(base, d))

export function seedRequests(now: Date): TimeOffRequest[] {
  const t = now.getTime()
  return [
    { id: 'r1', empId: 'e1', typeId: 'vac', from: '2026-08-03', to: '2026-08-14', status: 'approved', createdAt: t - 90 * 864e5, decidedBy: 'e9' },
    { id: 'r2', empId: 'e1', typeId: 'vac', from: '2026-04-06', to: '2026-04-10', status: 'approved', createdAt: t - 200 * 864e5, decidedBy: 'e9' },
    { id: 'r3', empId: 'e1', typeId: 'own', from: rel(now, -23), to: rel(now, -23), status: 'approved', createdAt: t - 30 * 864e5, decidedBy: 'e9' },
    { id: 'r4', empId: 'e1', typeId: 'med', from: rel(now, -9), to: rel(now, -9), hours: 2, status: 'approved', createdAt: t - 12 * 864e5, decidedBy: 'e9' },
    { id: 'r5', empId: 'e3', typeId: 'vac', from: '2026-12-21', to: '2026-12-31', note: 'Navidades en Asturias', status: 'pending', createdAt: t - 2 * 864e5 },
    { id: 'r6', empId: 'e4', typeId: 'vac', from: '2026-12-21', to: '2026-12-24', status: 'pending', createdAt: t - 864e5 },
    { id: 'r7', empId: 'e2', typeId: 'own', from: rel(now, 6), to: rel(now, 6), note: 'Mudanza', status: 'pending', createdAt: t - 5 * 36e5 },
    { id: 'r8', empId: 'e6', typeId: 'vac', from: rel(now, -1), to: rel(now, 3), status: 'approved', createdAt: t - 40 * 864e5, decidedBy: 'e1' },
    { id: 'r9', empId: 'e11', typeId: 'sick', from: rel(now, 0), to: rel(now, 1), status: 'approved', createdAt: t - 3 * 36e5, decidedBy: 'e1' },
    { id: 'r10', empId: 'e9', typeId: 'vac', from: '2026-12-28', to: '2027-01-05', status: 'approved', createdAt: t - 20 * 864e5, decidedBy: 'e1' },
  ]
}

function isOff(empId: string, k: string, reqs: TimeOffRequest[]) {
  return reqs.some((r) => r.empId === empId && r.status === 'approved' && !r.hours && r.from <= k && r.to >= k)
}

/** Genera fichajes realistas para un empleado en un día (o hasta `until` si es hoy). */
export function genDay(emp: Employee, day: Date, rnd: () => number, until?: number): Omit<Punch, 'seq' | 'prevHash' | 'hash'>[] {
  const zone = ZONES.find((z) => z.id === emp.zoneId)!
  const remote = emp.remoteDays.includes(isoDow(day))
  const home = jitter(zone, 6000, mulberry32(emp.hue * 97))
  const g = () => (rnd() + rnd() + rnd() - 1.5) * 2 // ~N(0,1)
  const inMin = toMin(emp.start) + g() * 7
  const dur = (emp.weeklyHours / 5) * 60
  const bStart = Math.max(inMin + 180, 13.5 * 60 + g() * 15)
  const bLen = emp.breakMin + g() * 6
  const outMin = inMin + dur + bLen + g() * 12 + (rnd() < 0.12 ? 40 + rnd() * 70 : 0)
  const seq: [Punch['type'], number][] = [['in', inMin], ['break_start', bStart], ['break_end', bStart + bLen], ['out', outMin]]
  const out: Omit<Punch, 'seq' | 'prevHash' | 'hash'>[] = []
  for (const [type, m] of seq) {
    const ts = atMin(day, m) + Math.floor(rnd() * 59000)
    if (until && ts > until) break
    const p = remote ? jitter(home, 25, rnd) : jitter(zone, zone.radius * 0.55, rnd)
    out.push({ id: `${emp.id}-${dayKey(day)}-${type}`, empId: emp.id, type, ts, lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), acc: Math.round(6 + rnd() * 22), zoneId: remote ? null : zone.id, remote, dist: undefined, method: 'app', flags: [] })
  }
  return out
}

export function genRange(emps: Employee[], from: Date, to: Date, reqs: TimeOffRequest[], now: number) {
  const rows: Omit<Punch, 'seq' | 'prevHash' | 'hash'>[] = []
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const k = dayKey(d)
    const dow = isoDow(d)
    if (dow > 5 || HOLIDAYS[k]) continue
    for (const e of emps) {
      if (isOff(e.id, k, reqs)) continue
      const rnd = mulberry32(Number(k.replace(/-/g, '')) * 31 + e.hue * 7 + e.id.length)
      const isToday = k === dayKey(now)
      rows.push(...genDay(e, d, rnd, isToday ? now : undefined))
    }
  }
  return rows
}

export function buildSeed(now = new Date()): Seed {
  const requests = seedRequests(now)
  const from = startOfMonth(subMonths(now, 2))
  const yesterday = addDays(now, -1)
  const raw = [
    ...genRange(EMPLOYEES.filter((e) => e.id === ME_ID), from, yesterday, requests, now.getTime()),
    ...genRange(EMPLOYEES.filter((e) => e.id !== ME_ID), from, now, requests, now.getTime()),
  ]
  // Anomalías deliberadas para que el copiloto tenga algo que detectar
  const forgot = findWorkday(now, -6)
  const fk = dayKey(forgot)
  const filtered = raw.filter((p) => !(p.empId === ME_ID && dayKey(p.ts) === fk && p.type === 'out'))
  const noBreak = dayKey(findWorkday(now, -3))
  const final = filtered.filter((p) => !(p.empId === ME_ID && dayKey(p.ts) === noBreak && p.type.startsWith('break')))
  const corrDay = dayKey(findWorkday(now, -2))
  for (let i = final.length - 1; i >= 0; i--) if (final[i].empId === 'e7' && dayKey(final[i].ts) === corrDay && final[i].type === 'out') final.splice(i, 1)
  const far = final.find((p) => p.empId === ME_ID && dayKey(p.ts) === dayKey(findWorkday(now, -12)) && p.type === 'in')
  if (far && far.zoneId) {
    const z = ZONES[0]
    Object.assign(far, { lat: z.lat + 0.0062, lng: z.lng + 0.004, zoneId: null, flags: ['fuera_de_zona'], remote: false })
  }
  final.sort((a, b) => a.ts - b.ts)
  const punches = sealChain(final)

  const corrections: Correction[] = [
    { id: 'c1', empId: 'e7', type: 'out', ts: atMin(findWorkday(now, -2), toMin('17:12')), reason: 'Se me apagó el móvil al salir', status: 'pending', createdAt: now.getTime() - 20 * 36e5 },
  ]
  const m0 = monthKey(now)
  const m1 = monthKey(subMonths(now, 1))
  const m2 = monthKey(subMonths(now, 2))
  const periods: Period[] = EMPLOYEES.flatMap((e) => [
    { empId: e.id, month: m2, status: 'approved' as const },
    { empId: e.id, month: m1, status: e.id === 'e3' || e.id === 'e8' ? ('submitted' as const) : ('approved' as const) },
    { empId: e.id, month: m0, status: 'open' as const },
  ])
  const notices: Notice[] = [
    { id: 'n1', ts: now.getTime() - 3 * 36e5, title: 'Nómina de octubre disponible', body: 'Ya puedes consultarla y descargarla.', icon: 'wallet' },
    { id: 'n2', ts: now.getTime() - 26 * 36e5, title: 'Marta ha pedido vacaciones', body: '21–31 dic · 7 días laborables', icon: 'plane' },
  ]
  return { punches, requests, corrections, periods, notices, seededThrough: dayKey(now) }
}

export function findWorkday(now: Date, offset: number) {
  let d = addDays(now, offset)
  while (isoDow(d) > 5 || HOLIDAYS[dayKey(d)]) d = addDays(d, -1)
  return d
}

export { parseDay }
