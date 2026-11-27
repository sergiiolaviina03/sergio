import type { Employee, Punch, TimeOffRequest, Zone } from '../types'
import { distanceM, getFix, jitter, type GeoFix } from './geo'
import { dayKey, isoDow } from './time'
import type { Settings } from '../store'

export type Check = { id: string; label: string; status: 'ok' | 'warn' | 'fail'; detail: string }
export type Verdict = {
  fix?: GeoFix
  zone?: Zone
  dist?: number
  inside: boolean
  remote: boolean
  checks: Check[]
  flags: string[]
  blocked: boolean
  score: number // 0-100 confianza
}

export async function locate(settings: Settings, zones: Zone[], me: Employee): Promise<GeoFix> {
  if (settings.locationMode === 'real') return getFix()
  await new Promise((r) => setTimeout(r, 650 + Math.random() * 500))
  const spot = settings.demoSpot
  const z = zones.find((x) => x.id === spot) ?? zones.find((x) => x.id === me.zoneId) ?? zones[0]
  if (spot === 'remote') {
    const p = jitter(z, 5200)
    return { ...p, acc: 18, ts: Date.now(), simulated: true }
  }
  if (spot === 'far') return { lat: z.lat + 0.011, lng: z.lng - 0.008, acc: 22, ts: Date.now(), simulated: true }
  const p = jitter(z, z.radius * 0.5)
  return { ...p, acc: Math.round(6 + Math.random() * 16), ts: Date.now(), simulated: true }
}

export function evaluate(fix: GeoFix | undefined, zones: Zone[], me: Employee, reqs: TimeOffRequest[], last: Punch | undefined, settings: Settings, now = new Date()): Verdict {
  const checks: Check[] = []
  const flags: string[] = []
  const k = dayKey(now)
  const remote = me.remoteDays.includes(isoDow(now)) || reqs.some((r) => r.empId === me.id && r.typeId === 'remote' && r.status === 'approved' && r.from <= k && r.to >= k)
  if (!fix) {
    checks.push({ id: 'gps', label: 'Ubicación', status: settings.strictGeofence ? 'fail' : 'warn', detail: 'Sin ubicación: el fichaje quedará marcado para revisión' })
    flags.push('sin_ubicacion')
    return { inside: false, remote, checks, flags, blocked: settings.strictGeofence, score: 35 }
  }
  let best: { z: Zone; d: number } | undefined
  for (const z of zones) {
    const d = distanceM(fix, z)
    if (!best || d < best.d) best = { z, d }
  }
  const tolerance = Math.min(fix.acc, 60)
  const inside = !!best && best.d <= best.z.radius + tolerance
  if (inside) checks.push({ id: 'zone', label: 'Geovalla', status: 'ok', detail: `Dentro de ${best!.z.name} · a ${Math.round(best!.d)} m del centro` })
  else if (remote) checks.push({ id: 'zone', label: 'Geovalla', status: 'ok', detail: 'Hoy tienes teletrabajo previsto: se registra como remoto' })
  else {
    checks.push({ id: 'zone', label: 'Geovalla', status: settings.strictGeofence ? 'fail' : 'warn', detail: best ? `Fuera de zona · ${best.d < 1000 ? Math.round(best.d) + ' m' : (best.d / 1000).toFixed(1) + ' km'} de ${best.z.name}` : 'No hay centros configurados' })
    flags.push('fuera_de_zona')
  }
  if (fix.acc > 100) {
    checks.push({ id: 'acc', label: 'Precisión', status: 'warn', detail: `Señal débil (±${Math.round(fix.acc)} m)` })
    flags.push('precision_baja')
  } else checks.push({ id: 'acc', label: 'Precisión', status: 'ok', detail: `±${Math.round(fix.acc)} m` })

  const spoof = fix.acc < 1.5 || (Number.isInteger(fix.lat * 1e4) && Number.isInteger(fix.lng * 1e4))
  if (spoof) {
    checks.push({ id: 'spoof', label: 'Antifraude', status: 'warn', detail: 'Patrón típico de ubicación simulada (precisión perfecta / coordenadas redondas)' })
    flags.push('posible_ubicacion_simulada')
  }
  if (last?.lat != null && last.lng != null) {
    const h = (fix.ts - last.ts) / 3600e3
    const km = distanceM(fix, { lat: last.lat, lng: last.lng }) / 1000
    if (h > 0 && km > 30 && km / h > 250) {
      checks.push({ id: 'travel', label: 'Antifraude', status: 'warn', detail: `Viaje imposible: ${Math.round(km)} km en ${Math.round(h * 60)} min desde el último fichaje` })
      flags.push('viaje_imposible')
    }
  }
  if (!spoof && !flags.includes('viaje_imposible')) checks.push({ id: 'spoof', label: 'Antifraude', status: 'ok', detail: 'Sin señales de manipulación' })
  const blocked = settings.strictGeofence && !inside && !remote
  const score = Math.max(5, 100 - (inside || remote ? 0 : 35) - (fix.acc > 100 ? 20 : fix.acc > 40 ? 8 : 0) - (spoof ? 30 : 0) - (flags.includes('viaje_imposible') ? 40 : 0))
  return { fix, zone: inside ? best!.z : undefined, dist: best?.d, inside, remote: !inside && remote, checks, flags, blocked, score }
}
