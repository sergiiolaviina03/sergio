// Acceso a datos del bot con la clave de servicio (se ejecuta solo en el servidor).
import type { Deps, Person, Punch, Session, Zone } from './handler.ts'

// deno-lint-ignore no-explicit-any
type Client = any

export function makeDeps(db: Client): Deps {
  const madrid = (ts: number) => new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
  return {
    async find(phone) {
      const { data, error } = await db.rpc('wa_find', { phone })
      if (error) throw new Error(error.message)
      return (data ?? []) as Person[]
    },
    async zones(company) {
      const { data } = await db.from('records').select('data').eq('company_id', company).eq('collection', 'zones')
      return ((data ?? []) as { data: Zone }[]).map((r) => r.data)
    },
    async remoteToday(company, emp) {
      const day = madrid(Date.now())
      const dow = ((new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1
      const { data: e } = await db.from('records').select('data').eq('company_id', company).eq('collection', 'employees').eq('id', emp).maybeSingle()
      if ((e?.data?.remoteDays ?? []).includes(dow)) return true
      const { data: reqs } = await db.from('records').select('data').eq('company_id', company).eq('collection', 'requests').eq('data->>empId', emp).eq('data->>typeId', 'remote').eq('data->>status', 'approved')
      return ((reqs ?? []) as { data: { from: string; to: string } }[]).some((r) => r.data.from <= day && r.data.to >= day)
    },
    async punchesSince(company, emp, since) {
      const { data, error } = await db.from('punches').select('type, ts, seq, hash').eq('company_id', company).eq('emp_id', emp).gte('ts', since).order('seq')
      if (error) throw new Error(error.message)
      return ((data ?? []) as Punch[]).map((p) => ({ ...p, ts: Number(p.ts) }))
    },
    async clock(company, emp, p) {
      const { data, error } = await db.rpc('wa_clock', { c: company, emp, p })
      if (error) throw new Error(error.message)
      return { seq: Number(data.seq), hash: data.hash, ts: Number(data.ts) }
    },
    async getSession(phone) {
      const { data } = await db.from('wa_sessions').select('*').eq('phone', phone).maybeSingle()
      return (data as Session) ?? null
    },
    async setSession(s, phone) {
      if (!s) await db.from('wa_sessions').delete().eq('phone', phone)
      else await db.from('wa_sessions').upsert(s)
    },
    async requireLocation(company) {
      const { data } = await db.from('records').select('data').eq('company_id', company).eq('collection', 'company').eq('id', 'main').maybeSingle()
      return data?.data?.waRequireLocation !== false
    },
    now: () => Date.now(),
  }
}
