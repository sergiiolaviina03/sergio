// Fichaje por QR dinámico: el quiosco muestra un código que cambia cada 30 s.
// Escanearlo con la cámara del móvil abre Aura y demuestra presencia física en el centro, incluso sin GPS.
import { sha256 } from './sha256'

export const QR_WINDOW = 30_000
export const qrToken = (secret: string, zoneId: string, w = Math.floor(Date.now() / QR_WINDOW)) => sha256(`${secret}|${zoneId}|${w}`).slice(0, 12)
export function qrValid(secret: string, zoneId: string, token: string) {
  const w = Math.floor(Date.now() / QR_WINDOW)
  return [w, w - 1, w - 2].some((x) => qrToken(secret, zoneId, x) === token)
}
export const qrUrl = (secret: string, zoneId: string) => `${location.origin}${location.pathname}#qr-${zoneId}-${qrToken(secret, zoneId)}`
export function parseQrHash(hash: string) {
  const m = hash.match(/^#?qr-([\w-]+?)-([0-9a-f]{12})$/)
  return m ? { zoneId: m[1], token: m[2] } : null
}
