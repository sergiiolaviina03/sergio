import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, startOfWeek, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

export const dayKey = (d: Date | number) => format(d, 'yyyy-MM-dd')
export const monthKey = (d: Date | number) => format(d, 'yyyy-MM')
export const fmt = (d: Date | number, f: string) => format(d, f, { locale: es })
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function hm(min: number, signed = false) {
  const s = min < 0 ? '−' : signed ? '+' : ''
  const a = Math.abs(Math.round(min))
  const h = Math.floor(a / 60)
  const m = a % 60
  return `${s}${h}h ${String(m).padStart(2, '0')}m`
}
export function clock(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export const atMin = (day: Date, min: number) => {
  const d = new Date(day)
  d.setHours(0, 0, 0, 0)
  return d.getTime() + min * 60000
}
export function monthDays(month: Date) {
  return eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
}
export function weekDays(d: Date) {
  const s = startOfWeek(d, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}
export { isWeekend }
export const isoDow = (d: Date) => ((d.getDay() + 6) % 7) + 1
export const parseDay = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const hShort = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`
