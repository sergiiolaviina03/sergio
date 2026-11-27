import type { Punch } from '../types'
import { sha256 } from './sha256'

export const GENESIS = '0'.repeat(64)

export function canonical(p: Omit<Punch, 'hash' | 'prevHash'> & { prevHash: string }) {
  return [p.seq, p.empId, p.type, p.ts, p.lat ?? '', p.lng ?? '', p.acc ?? '', p.zoneId ?? (p.zoneId === null ? '∅' : ''), p.remote ? 1 : 0, p.method, p.flags.join(','), p.note ?? '', p.selfie ? sha256(p.selfie) : '', p.prevHash].join('|')
}

export function seal(p: Omit<Punch, 'seq' | 'prevHash' | 'hash'>, prev: Punch | undefined): Punch {
  const seq = prev ? prev.seq + 1 : 1
  const prevHash = prev ? prev.hash : GENESIS
  const base = { ...p, seq, prevHash }
  return { ...base, hash: sha256(canonical(base)) }
}

export function sealChain(rows: Omit<Punch, 'seq' | 'prevHash' | 'hash'>[], start?: Punch): Punch[] {
  const out: Punch[] = []
  let prev = start
  for (const r of rows) {
    prev = seal(r, prev)
    out.push(prev)
  }
  return out
}

export type VerifyResult = { ok: boolean; checked: number; brokenAt?: number; reason?: string; head: string; ms: number }

export function verify(chain: Punch[]): VerifyResult {
  const t0 = performance.now()
  let prevHash = GENESIS
  for (let i = 0; i < chain.length; i++) {
    const p = chain[i]
    if (p.prevHash !== prevHash) return { ok: false, checked: i, brokenAt: p.seq, reason: 'Enlace roto con el registro anterior', head: prevHash, ms: performance.now() - t0 }
    const h = sha256(canonical(p))
    if (h !== p.hash) return { ok: false, checked: i, brokenAt: p.seq, reason: 'El contenido no coincide con su sello', head: prevHash, ms: performance.now() - t0 }
    prevHash = p.hash
  }
  return { ok: true, checked: chain.length, head: prevHash, ms: performance.now() - t0 }
}

export const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`
