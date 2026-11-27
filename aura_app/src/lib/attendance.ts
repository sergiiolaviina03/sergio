import type { Employee, Punch, TimeOffRequest } from '../types'
import { HOLIDAYS, TIME_OFF_TYPES } from '../data/seed'
import { dayKey, isoDow, toMin, atMin, parseDay } from './time'
import { addDays, eachDayOfInterval, startOfWeek } from 'date-fns'
import { useStore } from '../store'

export type Seg = { from: number; to: number; kind: 'work' | 'break' }
export type DaySummary = {
  punches: Punch[]
  worked: number // minutos
  breaks: number
  first?: number
  last?: number
  state: 'none' | 'working' | 'break' | 'done'
  segs: Seg[]
}

export function summarize(ps: Punch[], now = Date.now()): DaySummary {
  const punches = [...ps].sort((a, b) => a.ts - b.ts)
  const segs: Seg[] = []
  let state: DaySummary['state'] = 'none'
  let cursor: number | undefined
  for (const p of punches) {
    if (p.type === 'in' || p.type === 'break_end') {
      if (state === 'break' && cursor) segs.push({ from: cursor, to: p.ts, kind: 'break' })
      state = 'working'
      cursor = p.ts
    } else if (p.type === 'break_start') {
      if (state === 'working' && cursor) segs.push({ from: cursor, to: p.ts, kind: 'work' })
      state = 'break'
      cursor = p.ts
    } else if (p.type === 'out') {
      if (state === 'working' && cursor) segs.push({ from: cursor, to: p.ts, kind: 'work' })
      if (state === 'break' && cursor) segs.push({ from: cursor, to: p.ts, kind: 'break' })
      state = 'done'
      cursor = undefined
    }
  }
  const sameDay = punches.length && dayKey(punches[0].ts) === dayKey(now)
  if ((state === 'working' || state === 'break') && cursor && sameDay) segs.push({ from: cursor, to: now, kind: state === 'working' ? 'work' : 'break' })
  const worked = segs.filter((s) => s.kind === 'work').reduce((a, s) => a + (s.to - s.from), 0) / 60000
  const breaks = segs.filter((s) => s.kind === 'break').reduce((a, s) => a + (s.to - s.from), 0) / 60000
  return { punches, worked, breaks, first: punches[0]?.ts, last: punches.at(-1)?.ts, state, segs }
}

export function byDay(punches: Punch[], empId: string) {
  const m = new Map<string, Punch[]>()
  for (const p of punches) {
    if (p.empId !== empId) continue
    const k = dayKey(p.ts)
    const a = m.get(k)
    if (a) a.push(p)
    else m.set(k, [p])
  }
  return m
}

export function absenceOn(empId: string, k: string, reqs: TimeOffRequest[]) {
  return reqs.find((r) => r.empId === empId && r.status === 'approved' && r.from <= k && r.to >= k)
}

export function plannedMin(emp: Employee, day: Date, reqs: TimeOffRequest[]) {
  const k = dayKey(day)
  if (HOLIDAYS[k]) return 0
  if (isoDow(day) > 5 && !useStore.getState?.().shifts?.some((x) => x.empId === emp.id && x.published && x.date === k)) return 0
  let daily = (emp.weeklyHours / 5) * 60
  // Si hay cuadrante publicado para esa semana, manda el cuadrante (incluido el fin de semana)
  const sh = useStore.getState?.().shifts?.filter((x) => x.empId === emp.id && x.published) ?? []
  if (sh.length) {
    const ws = dayKey(startOfWeek(day, { weekStartsOn: 1 }))
    const we = dayKey(addDays(startOfWeek(day, { weekStartsOn: 1 }), 6))
    if (sh.some((x) => x.date >= ws && x.date <= we)) daily = sh.filter((x) => x.date === k).reduce((a, x) => a + shiftMinutes(x), 0)
  }
  const a = absenceOn(emp.id, k, reqs)
  if (a) return a.hours ? Math.max(0, daily - a.hours * 60) : 0
  return daily
}

export type Issue = { day: string; kind: 'missing_out' | 'no_break' | 'long_day' | 'out_of_zone' | 'holiday' | 'short_rest'; title: string; detail: string; suggestTs?: number; severity: 'high' | 'mid' | 'low' }

/** Motor de detección de inconsistencias: lo que un responsable revisaría a mano, pero automático. */
export function findIssues(emp: Employee, map: Map<string, Punch[]>, today = new Date()): Issue[] {
  const out: Issue[] = []
  const tk = dayKey(today)
  const keys = [...map.keys()].sort()
  let prevLast: number | undefined
  for (const k of keys) {
    const s = summarize(map.get(k)!, today.getTime())
    const day = parseDay(k)
    if (k !== tk && (s.state === 'working' || s.state === 'break')) {
      // Sugerencia: la mediana de tus salidas recientes
      const outs = keys.filter((x) => x < k).slice(-10).map((x) => map.get(x)!.find((p) => p.type === 'out')).filter(Boolean).map((p) => toMin(new Date(p!.ts).toTimeString().slice(0, 5)))
      outs.sort((a, b) => a - b)
      const med = outs.length ? outs[Math.floor(outs.length / 2)] : toMin(emp.end)
      out.push({ day: k, kind: 'missing_out', severity: 'high', title: 'Falta la salida', detail: `Fichaste entrada y no salida. Tu salida habitual ronda las ${String(Math.floor(med / 60)).padStart(2, '0')}:${String(med % 60).padStart(2, '0')}.`, suggestTs: atMin(day, med) })
    }
    if (s.worked > 6 * 60 && s.breaks < 15 && s.state === 'done') out.push({ day: k, kind: 'no_break', severity: 'mid', title: 'Jornada >6 h sin pausa', detail: 'El art. 34.4 ET exige un descanso mínimo de 15 min en jornadas continuadas de más de 6 h.' })
    if (s.worked > 10 * 60) out.push({ day: k, kind: 'long_day', severity: 'mid', title: 'Jornada muy larga', detail: `${Math.round(s.worked / 6) / 10} h trabajadas. Revisa si son horas extra o un olvido.` })
    const off = s.punches.find((p) => p.zoneId === null && !p.remote)
    if (off) out.push({ day: k, kind: 'out_of_zone', severity: 'low', title: 'Fichaje fuera de zona', detail: `Un fichaje de ${off.type === 'in' ? 'entrada' : 'salida'} se registró fuera de cualquier centro y sin teletrabajo previsto.` })
    if (HOLIDAYS[k] && s.punches.length) out.push({ day: k, kind: 'holiday', severity: 'low', title: 'Trabajo en festivo', detail: `${HOLIDAYS[k]}: se compensará según convenio.` })
    if (prevLast && s.first && s.first - prevLast < 12 * 3600e3) out.push({ day: k, kind: 'short_rest', severity: 'mid', title: 'Descanso entre jornadas < 12 h', detail: 'El art. 34.3 ET exige 12 h entre el final de una jornada y el inicio de la siguiente.' })
    prevLast = s.state === 'done' ? s.last : undefined
  }
  return out.reverse()
}

export function rangeStats(emp: Employee, map: Map<string, Punch[]>, reqs: TimeOffRequest[], from: Date, to: Date, now = Date.now()) {
  let worked = 0
  let planned = 0
  let overtime = 0
  const end = new Date(Math.min(to.getTime(), now))
  if (end < from) return { worked, planned, balance: 0, overtime }
  for (const d of eachDayOfInterval({ start: from, end })) {
    const k = dayKey(d)
    const s = map.get(k)
    const w = s ? summarize(s, now).worked : 0
    const p = plannedMin(emp, d, reqs)
    // Hoy solo cuenta lo planificado si el día ya acabó para no penalizar en directo
    const pl = k === dayKey(now) && (!s || summarize(s, now).state !== 'done') ? Math.min(p, w) : p
    worked += w
    planned += pl
    if (w > p + 15) overtime += w - p
  }
  return { worked, planned, balance: worked - planned, overtime }
}

export function timeOffUsage(empId: string, reqs: TimeOffRequest[], year: number) {
  const res: Record<string, { used: number; pending: number }> = {}
  for (const t of TIME_OFF_TYPES) res[t.id] = { used: 0, pending: 0 }
  for (const r of reqs) {
    if (r.empId !== empId || r.status === 'rejected') continue
    const n = r.hours ?? workingDays(parseDay(r.from), parseDay(r.to)).filter((d) => d.getFullYear() === year).length
    if (!r.hours && !workingDays(parseDay(r.from), parseDay(r.to)).some((d) => d.getFullYear() === year)) continue
    if (r.status === 'approved') res[r.typeId].used += n
    else res[r.typeId].pending += n
  }
  return res
}

export function workingDays(from: Date, to: Date) {
  if (to < from) return []
  return eachDayOfInterval({ start: from, end: to }).filter((d) => isoDow(d) <= 5 && !HOLIDAYS[dayKey(d)])
}

export function nextWorkday(d: Date) {
  let x = addDays(d, 1)
  while (isoDow(x) > 5 || HOLIDAYS[dayKey(x)]) x = addDays(x, 1)
  return x
}

export function shiftMinutes(x: { start: string; end: string; breakMin: number }) {
  let d = toMin(x.end) - toMin(x.start)
  if (d <= 0) d += 24 * 60
  return Math.max(0, d - x.breakMin)
}
