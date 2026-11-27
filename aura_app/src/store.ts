import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Correction, Employee, Notice, Period, Punch, PunchType, TimeOffRequest, Zone, Method } from './types'
import { EMPLOYEES, ME_ID, ZONES, buildSeed, genRange } from './data/seed'
import { seal, sealChain } from './lib/ledger'
import { uid } from './lib/rng'
import { dayKey, monthKey, parseDay } from './lib/time'
import { addDays } from 'date-fns'

export type Settings = {
  theme: 'light' | 'dark' | 'system'
  viewAs: 'manager' | 'employee'
  requireSelfie: boolean
  strictGeofence: boolean
  locationMode: 'real' | 'demo'
  demoSpot: string // zoneId | 'remote' | 'far'
  autoBreakReminder: boolean
}

export type PunchCtx = { lat?: number; lng?: number; acc?: number; zoneId?: string | null; dist?: number; remote?: boolean; method?: Method; selfie?: string; flags?: string[]; note?: string; ts?: number; empId?: string }

type State = {
  meId: string
  zones: Zone[]
  employees: Employee[]
  punches: Punch[]
  requests: TimeOffRequest[]
  corrections: Correction[]
  periods: Period[]
  notices: Notice[]
  settings: Settings
  seededThrough: string
  tampered?: { id: string; original: Punch }
  punch: (type: PunchType, ctx?: PunchCtx) => Punch
  requestTimeOff: (r: Omit<TimeOffRequest, 'id' | 'status' | 'createdAt' | 'empId'> & { empId?: string }) => TimeOffRequest
  cancelRequest: (id: string) => void
  decideRequest: (id: string, ok: boolean) => void
  requestCorrection: (c: Omit<Correction, 'id' | 'status' | 'createdAt' | 'empId'>) => void
  decideCorrection: (id: string, ok: boolean) => void
  submitPeriod: (month: string) => void
  decidePeriod: (empId: string, month: string) => void
  upsertZone: (z: Zone) => void
  removeZone: (id: string) => void
  setSettings: (s: Partial<Settings>) => void
  notify: (n: Omit<Notice, 'id' | 'ts'>) => void
  readAll: () => void
  tamper: () => void
  untamper: () => void
  topUp: () => void
  reset: () => void
}

const initial = () => {
  const s = buildSeed(new Date())
  return {
    meId: ME_ID,
    zones: ZONES,
    employees: EMPLOYEES,
    ...s,
    settings: { theme: 'system', viewAs: 'manager', requireSelfie: false, strictGeofence: false, locationMode: 'demo', demoSpot: 'mad', autoBreakReminder: true } as Settings,
    tampered: undefined,
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial(),
      punch: (type, ctx = {}) => {
        const { punches, meId } = get()
        const p = seal(
          {
            id: uid('p_'),
            empId: ctx.empId ?? meId,
            type,
            ts: ctx.ts ?? Date.now(),
            lat: ctx.lat,
            lng: ctx.lng,
            acc: ctx.acc,
            zoneId: ctx.zoneId,
            dist: ctx.dist,
            remote: ctx.remote,
            method: ctx.method ?? 'app',
            selfie: ctx.selfie,
            flags: ctx.flags ?? [],
            note: ctx.note,
          },
          punches.at(-1),
        )
        set({ punches: [...punches, p] })
        return p
      },
      requestTimeOff: (r) => {
        const req: TimeOffRequest = { ...r, empId: r.empId ?? get().meId, id: uid('r_'), status: 'pending', createdAt: Date.now() }
        set({ requests: [...get().requests, req] })
        return req
      },
      cancelRequest: (id) => set({ requests: get().requests.filter((r) => r.id !== id) }),
      decideRequest: (id, ok) => set({ requests: get().requests.map((r) => (r.id === id ? { ...r, status: ok ? 'approved' : 'rejected', decidedBy: get().meId } : r)) }),
      requestCorrection: (c) => set({ corrections: [...get().corrections, { ...c, empId: get().meId, id: uid('c_'), status: 'pending', createdAt: Date.now() }] }),
      decideCorrection: (id, ok) => {
        const c = get().corrections.find((x) => x.id === id)
        if (!c) return
        set({ corrections: get().corrections.map((x) => (x.id === id ? { ...x, status: ok ? 'approved' : 'rejected' } : x)) })
        // Una corrección aprobada NO edita el pasado: se añade un registro nuevo al libro, enlazado y trazable.
        if (ok) get().punch(c.type, { empId: c.empId, ts: c.ts, method: 'correction', flags: ['corrección'], note: c.reason })
      },
      submitPeriod: (month) => set({ periods: upsertPeriod(get().periods, { empId: get().meId, month, status: 'submitted' }) }),
      decidePeriod: (empId, month) => set({ periods: upsertPeriod(get().periods, { empId, month, status: 'approved' }) }),
      upsertZone: (z) => set({ zones: get().zones.some((x) => x.id === z.id) ? get().zones.map((x) => (x.id === z.id ? z : x)) : [...get().zones, z] }),
      removeZone: (id) => set({ zones: get().zones.filter((z) => z.id !== id) }),
      setSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      notify: (n) => set({ notices: [{ ...n, id: uid('n_'), ts: Date.now() }, ...get().notices].slice(0, 40) }),
      readAll: () => set({ notices: get().notices.map((n) => ({ ...n, read: true })) }),
      tamper: () => {
        const { punches, meId } = get()
        const idx = punches.findLastIndex((p) => p.empId === meId && p.type === 'out' && p.ts < Date.now() - 864e5)
        if (idx < 0) return
        const original = punches[idx]
        const forged = { ...original, ts: original.ts + 47 * 60000 } // alguien "regala" 47 min sin re-sellar
        set({ punches: punches.map((p, i) => (i === idx ? forged : p)), tampered: { id: original.id, original } })
      },
      untamper: () => {
        const t = get().tampered
        if (!t) return
        set({ punches: get().punches.map((p) => (p.id === t.id ? t.original : p)), tampered: undefined })
      },
      topUp: () => {
        // Mantiene viva la demo: rellena los días transcurridos del equipo desde la última visita.
        const { seededThrough, employees, meId, requests, punches } = get()
        const today = dayKey(new Date())
        if (seededThrough >= today) return
        const from = addDays(parseDay(seededThrough), 1)
        const rows = genRange(employees.filter((e) => e.id !== meId), from, new Date(), requests, Date.now())
        // Elimina restos parciales del día que se sembró (ya cerrado) completándolo
        const partialDay = genRange(employees.filter((e) => e.id !== meId), parseDay(seededThrough), parseDay(seededThrough), requests, Date.now()).filter((r) => !punches.some((p) => p.id === r.id))
        const all = [...partialDay, ...rows].sort((a, b) => a.ts - b.ts)
        const sealed = sealChain(all, punches.at(-1))
        set({ punches: [...punches, ...sealed], seededThrough: today, periods: ensurePeriods(get().periods, employees) })
      },
      reset: () => set(initial()),
    }),
    {
      name: 'aura-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ ...s, tampered: undefined }) as unknown as State,
      onRehydrateStorage: () => (s) => {
        if (s?.tampered) s.untamper()
      },
    },
  ),
)

function upsertPeriod(ps: Period[], p: Period) {
  return ps.some((x) => x.empId === p.empId && x.month === p.month) ? ps.map((x) => (x.empId === p.empId && x.month === p.month ? p : x)) : [...ps, p]
}
function ensurePeriods(ps: Period[], emps: Employee[]) {
  const m = monthKey(new Date())
  let out = ps
  for (const e of emps) if (!out.some((p) => p.empId === e.id && p.month === m)) out = [...out, { empId: e.id, month: m, status: 'open' }]
  return out
}

export const useMe = () => {
  const meId = useStore((s) => s.meId)
  const emps = useStore((s) => s.employees)
  return emps.find((e) => e.id === meId)!
}
