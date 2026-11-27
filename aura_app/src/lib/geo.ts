export type LatLng = { lat: number; lng: number }

export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000
  const toR = (d: number) => (d * Math.PI) / 180
  const dLat = toR(b.lat - a.lat)
  const dLng = toR(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export type GeoFix = LatLng & { acc: number; ts: number; simulated?: boolean }

export function getFix(timeoutMs = 9000): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Este navegador no permite geolocalización'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, ts: p.timestamp }),
      (e) => reject(new Error(e.code === 1 ? 'Permiso de ubicación denegado' : e.code === 3 ? 'La ubicación tardó demasiado' : 'No se pudo obtener la ubicación')),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15000 },
    )
  })
}

/** Small random offset (meters) around a point — used by demo mode to simulate a realistic GPS fix. */
export function jitter(p: LatLng, meters: number, rnd = Math.random): LatLng {
  const ang = rnd() * Math.PI * 2
  const d = Math.sqrt(rnd()) * meters
  return { lat: p.lat + (d * Math.cos(ang)) / 111320, lng: p.lng + (d * Math.sin(ang)) / (111320 * Math.cos((p.lat * Math.PI) / 180)) }
}

export function fmtDist(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}
