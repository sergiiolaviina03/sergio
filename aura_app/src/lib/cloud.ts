// Conexión con el servidor (Supabase, código abierto y autoalojable): cuentas, empresa, sincronización
// en tiempo real y cola sin conexión. Sin servidor configurado, Aura funciona en modo demostración local.
import { createClient, type SupabaseClient, type Session, type RealtimeChannel } from '@supabase/supabase-js'
import { create } from 'zustand'
import { useStore } from '../store'
import type { Employee, HRDocument, Punch, PunchType, Signature } from '../types'
import { uid } from './rng'
import { sha256 } from './sha256'
import { COMPANY } from '../data/seed'

export type Role = 'admin' | 'manager' | 'employee'
type CloudState = {
  client?: SupabaseClient
  session?: Session | null
  companyId?: string
  role?: Role
  employeeId?: string
  status: 'off' | 'auth' | 'onboarding' | 'loading' | 'ready' | 'error'
  error?: string
  online: boolean
  pending: number
  members: { employee_id: string; role: Role }[]
}
export const cloud = create<CloudState>(() => ({ status: 'off', online: typeof navigator === 'undefined' ? true : navigator.onLine, pending: 0, members: [] }))

const CFG_KEY = 'aura-server'
const MODE_KEY = 'aura-mode'
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v == null) localStorage.removeItem(k)
      else localStorage.setItem(k, v)
    } catch {
      /* sin almacenamiento */
    }
  },
}

export function serverConfig(): { url: string; key: string; fromEnv: boolean } | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (url && key) return { url, key, fromEnv: true }
  try {
    const c = JSON.parse(ls.get(CFG_KEY) ?? 'null')
    return c?.url && c?.key ? { ...c, fromEnv: false } : null
  } catch {
    return null
  }
}
export function saveServerConfig(url: string, key: string | null) {
  ls.set(CFG_KEY, key ? JSON.stringify({ url: url.trim().replace(/\/$/, ''), key: key.trim() }) : null)
  location.reload()
}
export const demoForced = () => ls.get(MODE_KEY) === 'demo'
export function useDemo(on: boolean) {
  ls.set(MODE_KEY, on ? 'demo' : null)
  location.reload()
}
export const isCloud = () => cloud.getState().status === 'ready'

/* ------------------------------------------------------------------ */
/* Correspondencia entre el estado de la app y las tablas del servidor */
/* ------------------------------------------------------------------ */
const PAYROLL_KEYS = ['salary', 'pagas', 'contract', 'children', 'pin', 'dni', 'phone', 'email'] as const
type Coll = 'employees' | 'zones' | 'requests' | 'corrections' | 'periods' | 'documents' | 'expenses' | 'shifts'
const COLLS: Coll[] = ['employees', 'zones', 'requests', 'corrections', 'periods', 'documents', 'expenses', 'shifts']
const keyOf = (coll: Coll, x: Record<string, unknown>) => (coll === 'periods' ? `${x.empId}:${x.month}` : String(x.id))

type Row = { collection: string; id: string; data: Record<string, unknown> }
function toRows(coll: Coll, x: Record<string, unknown>): Row[] {
  if (coll === 'employees') {
    const pub: Record<string, unknown> = { ...x, empId: x.id }
    const pay: Record<string, unknown> = { empId: x.id }
    for (const k of PAYROLL_KEYS) {
      pay[k] = x[k]
      delete pub[k]
    }
    return [
      { collection: 'employees', id: String(x.id), data: pub },
      { collection: 'payroll', id: String(x.id), data: pay },
    ]
  }
  return [{ collection: coll, id: keyOf(coll, x), data: x }]
}

export const punchToRow = (p: Omit<Punch, 'seq' | 'prevHash' | 'hash'>) => ({
  id: p.id,
  empId: p.empId,
  type: p.type,
  ts: p.ts,
  lat: p.lat == null ? null : String(p.lat),
  lng: p.lng == null ? null : String(p.lng),
  acc: p.acc ?? null,
  zone: p.zoneId === undefined ? '' : p.zoneId === null ? '∅' : p.zoneId,
  remote: !!p.remote,
  method: p.method,
  flags: p.flags,
  note: p.note ?? null,
  selfie: p.selfie ?? null,
})
type PunchRow = { seq: number; id: string; emp_id: string; type: PunchType; ts: number; lat: string | null; lng: string | null; acc: number | null; zone: string; remote: boolean; method: Punch['method']; flags: string[]; note: string | null; selfie: string | null; prev_hash: string; hash: string }
export const rowToPunch = (r: PunchRow): Punch => ({
  seq: Number(r.seq),
  id: r.id,
  empId: r.emp_id,
  type: r.type,
  ts: Number(r.ts),
  lat: r.lat == null ? undefined : Number(r.lat),
  lng: r.lng == null ? undefined : Number(r.lng),
  acc: r.acc ?? undefined,
  zoneId: r.zone === '' ? undefined : r.zone === '∅' ? null : r.zone,
  remote: r.remote,
  method: r.method,
  flags: r.flags ?? [],
  note: r.note ?? undefined,
  selfie: r.selfie ?? undefined,
  prevHash: r.prev_hash,
  hash: r.hash,
})

/* ------------------------------------------------------------------ */
/* Arranque y sesión                                                   */
/* ------------------------------------------------------------------ */
let channel: RealtimeChannel | undefined
let unsubStore: (() => void) | undefined
let applying = false
let snapshot: Record<Coll, Map<string, unknown>> = Object.fromEntries(COLLS.map((c) => [c, new Map()])) as Record<Coll, Map<string, unknown>>

export async function initCloud() {
  const cfg = serverConfig()
  if (!cfg || demoForced()) return
  const client = createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  cloud.setState({ client, status: 'loading' })
  window.addEventListener('online', () => {
    cloud.setState({ online: true })
    flushOutbox()
  })
  window.addEventListener('offline', () => cloud.setState({ online: false }))
  const { data } = await client.auth.getSession()
  client.auth.onAuthStateChange((ev, session) => {
    cloud.setState({ session })
    if (ev === 'SIGNED_IN' && cloud.getState().status !== 'ready') afterLogin()
    if (ev === 'SIGNED_OUT') teardown()
  })
  cloud.setState({ session: data.session })
  if (data.session) await afterLogin()
  else cloud.setState({ status: 'auth' })
}

const pendingInvite = () => location.hash.match(/^#unirse-([A-Z0-9]{6,12})$/i)?.[1]

export async function afterLogin() {
  const c = cloud.getState()
  if (!c.client) return
  cloud.setState({ status: 'loading' })
  const code = pendingInvite() ?? ls.get('aura-invite')
  if (code) {
    const { error } = await c.client.rpc('claim_invite', { invite_code: code })
    ls.set('aura-invite', null)
    if (!error) history.replaceState(null, '', '#inicio')
  }
  const uidNow = (await c.client.auth.getUser()).data.user?.id
  const { data: mem, error } = await c.client.from('members').select('company_id, employee_id, role').eq('user_id', uidNow ?? '')
  if (error) return cloud.setState({ status: 'error', error: error.message })
  if (!mem?.length) return cloud.setState({ status: 'onboarding' })
  const pick = mem.find((m) => m.company_id === ls.get('aura-company')) ?? mem[0]
  ls.set('aura-company', pick.company_id)
  cloud.setState({ companyId: pick.company_id, role: pick.role as Role, employeeId: pick.employee_id })
  await loadAll()
}

async function fetchAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

export async function loadAll() {
  const { client, companyId, employeeId, role } = cloud.getState()
  if (!client || !companyId) return
  try {
    const [records, punches, company, members] = await Promise.all([
      fetchAll<Row>((a, b) => client.from('records').select('collection, id, data').eq('company_id', companyId).range(a, b)),
      fetchAll<PunchRow>((a, b) => client.from('punches').select('*').eq('company_id', companyId).order('seq').range(a, b)),
      client.from('companies').select('name, qr_secret').eq('id', companyId).single(),
      client.from('members').select('employee_id, role').eq('company_id', companyId),
    ])
    const by = (c: string) => records.filter((r) => r.collection === c)
    const pay = new Map(by('payroll').map((r) => [r.id, r.data]))
    const employees = by('employees').map((r) => ({ salary: 0, pagas: 14, contract: 'indefinido', children: 0, pin: '0000', ...r.data, ...(pay.get(r.id) ?? {}), id: r.id }) as unknown as Employee)
    const state: Record<string, unknown> = {}
    for (const c of COLLS) state[c] = c === 'employees' ? employees : by(c).map((r) => r.data)
    const companyRec = by('company')[0]?.data as typeof COMPANY | undefined
    const comp = { ...COMPANY, name: company.data?.name ?? COMPANY.name, ...(companyRec ?? {}) }
    Object.assign(COMPANY, comp)
    applying = true
    const s = useStore.getState()
    useStore.setState({
      ...(state as object),
      punches: [...punches.map(rowToPunch), ...readOutbox().map(provisional)],
      company: comp,
      qrSecret: company.data?.qr_secret ?? s.qrSecret,
      meId: employeeId!,
      seededThrough: '9999-12-31',
      notices: [],
      tampered: undefined,
      settings: { ...s.settings, viewAs: role === 'employee' ? 'employee' : 'manager', locationMode: 'real' },
    })
    takeSnapshot()
    applying = false
    cloud.setState({ status: 'ready', members: (members.data ?? []) as CloudState['members'], pending: readOutbox().length })
    installOverrides()
    subscribe()
    flushOutbox()
  } catch (e) {
    applying = false
    cloud.setState({ status: 'error', error: (e as Error).message })
  }
}

function takeSnapshot() {
  const s = useStore.getState() as unknown as Record<Coll, Record<string, unknown>[]>
  snapshot = Object.fromEntries(COLLS.map((c) => [c, new Map(s[c].map((x) => [keyOf(c, x), x]))])) as typeof snapshot
}

/* ------------------------------------------------------------------ */
/* Sincronización saliente: cada cambio del estado se envía al servidor */
/* ------------------------------------------------------------------ */
let flushTimer: ReturnType<typeof setTimeout> | undefined
function subscribe() {
  const { client, companyId } = cloud.getState()
  if (!client || !companyId) return
  unsubStore?.()
  unsubStore = useStore.subscribe(() => {
    if (applying) return
    clearTimeout(flushTimer)
    flushTimer = setTimeout(pushChanges, 350)
  })
  channel?.unsubscribe()
  channel = client
    .channel('aura-' + companyId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `company_id=eq.${companyId}` }, (p) => applyRemoteRecord(p.eventType, (p.new ?? p.old) as Row))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'punches', filter: `company_id=eq.${companyId}` }, (p) => applyRemotePunch(rowToPunch(p.new as PunchRow)))
    .subscribe()
}

async function pushChanges() {
  const { client, companyId, role } = cloud.getState()
  if (!client || !companyId) return
  const s = useStore.getState() as unknown as Record<Coll, Record<string, unknown>[]> & { company: typeof COMPANY }
  const upserts: Row[] = []
  const deletes: Row[] = []
  for (const c of COLLS) {
    const prev = snapshot[c]
    const now = new Map(s[c].map((x) => [keyOf(c, x), x]))
    for (const [k, x] of now) {
      if (prev.get(k) === x) continue
      // Los documentos solo se crean desde aquí; las firmas van por sign_document()
      if (c === 'documents' && prev.has(k)) continue
      upserts.push(...toRows(c, x))
    }
    for (const [k, x] of prev) if (!now.has(k)) deletes.push(...toRows(c, x as Record<string, unknown>))
  }
  if (role === 'admin' && JSON.stringify(s.company) !== JSON.stringify(lastCompany)) {
    upserts.push({ collection: 'company', id: 'main', data: s.company as unknown as Record<string, unknown> })
    await client.from('companies').update({ name: s.company.name }).eq('id', companyId)
    lastCompany = s.company
  }
  takeSnapshot()
  if (upserts.length) {
    const { error } = await client.from('records').upsert(upserts.map((r) => ({ company_id: companyId, ...r, updated_at: new Date().toISOString() })))
    if (error) report(error.message)
  }
  for (const d of deletes) {
    const { error } = await client.from('records').delete().match({ company_id: companyId, collection: d.collection, id: d.id })
    if (error) report(error.message)
  }
}
let lastCompany: unknown = null

function report(msg: string) {
  import('../components/ui').then(({ toast }) => toast({ title: 'No se pudo guardar en el servidor', body: /row-level|permission/i.test(msg) ? 'No tienes permiso para este cambio.' : msg, tone: 'bad' }))
  setTimeout(loadAll, 800)
}

/* ------------------------------------------------------------------ */
/* Cambios que llegan del servidor (otros dispositivos)                */
/* ------------------------------------------------------------------ */
function applyRemoteRecord(ev: string, r: Row) {
  const s = useStore.getState() as unknown as Record<string, Record<string, unknown>[]>
  applying = true
  if (r.collection === 'payroll' || r.collection === 'employees') {
    const list = s.employees
    const cur = list.find((e) => e.id === r.id) ?? {}
    const next = ev === 'DELETE' ? list.filter((e) => e.id !== r.id) : list.some((e) => e.id === r.id) ? list.map((e) => (e.id === r.id ? { ...cur, ...r.data, id: r.id } : e)) : [...list, { ...r.data, id: r.id }]
    useStore.setState({ employees: next } as never)
  } else if (r.collection === 'company') {
    Object.assign(COMPANY, r.data)
    useStore.setState({ company: { ...COMPANY } })
  } else if ((COLLS as string[]).includes(r.collection)) {
    const c = r.collection as Coll
    const list = s[c]
    const next = ev === 'DELETE' ? list.filter((x) => keyOf(c, x) !== r.id) : list.some((x) => keyOf(c, x) === r.id) ? list.map((x) => (keyOf(c, x) === r.id ? r.data : x)) : [...list, r.data]
    useStore.setState({ [c]: next } as never)
  }
  takeSnapshot()
  applying = false
}

function applyRemotePunch(p: Punch) {
  const s = useStore.getState()
  applying = true
  const exists = s.punches.some((x) => x.id === p.id)
  useStore.setState({ punches: exists ? s.punches.map((x) => (x.id === p.id ? p : x)) : [...s.punches, p].sort(bySeq) })
  applying = false
}
const bySeq = (a: Punch, b: Punch) => (a.seq || 1e15) - (b.seq || 1e15) || a.ts - b.ts

/* ------------------------------------------------------------------ */
/* Fichajes: sellado en servidor + cola sin conexión                   */
/* ------------------------------------------------------------------ */
type Draft = Omit<Punch, 'seq' | 'prevHash' | 'hash'>
const OUTBOX = 'aura-outbox'
const readOutbox = (): Draft[] => {
  try {
    return JSON.parse(ls.get(OUTBOX) ?? '[]')
  } catch {
    return []
  }
}
const writeOutbox = (d: Draft[]) => {
  ls.set(OUTBOX, JSON.stringify(d))
  cloud.setState({ pending: d.length })
}
const provisional = (d: Draft): Punch => ({ ...d, seq: 0, prevHash: '', hash: '' })

let flushing = false
export async function flushOutbox() {
  const { client, companyId } = cloud.getState()
  if (!client || !companyId || flushing) return
  flushing = true
  let box = readOutbox()
  for (const d of [...box]) {
    const { data, error } = await client.rpc('clock', { c: companyId, p: punchToRow(d) })
    if (error) {
      // Error de red: se reintenta más tarde. Error de permiso o de datos: se descarta y se avisa.
      if (/fetch|network|Failed/i.test(error.message)) break
      box = box.filter((x) => x.id !== d.id)
      useStore.setState({ punches: useStore.getState().punches.filter((x) => x.id !== d.id) })
      import('../components/ui').then(({ toast }) => toast({ title: 'Fichaje rechazado por el servidor', body: error.message, tone: 'bad' }))
    } else {
      box = box.filter((x) => x.id !== d.id)
      applyRemotePunch(rowToPunch(data as PunchRow))
    }
    writeOutbox(box)
  }
  flushing = false
}

function installOverrides() {
  useStore.setState({
    punch: (type, ctx = {}) => {
      const s = useStore.getState()
      const d: Draft = { id: uid('p_'), empId: ctx.empId ?? s.meId, type, ts: ctx.ts ?? Date.now(), lat: ctx.lat, lng: ctx.lng, acc: ctx.acc, zoneId: ctx.zoneId, dist: ctx.dist, remote: ctx.remote, method: ctx.method ?? 'app', selfie: ctx.selfie, flags: ctx.flags ?? [], note: ctx.note }
      const p = provisional(d)
      useStore.setState({ punches: [...s.punches, p] })
      writeOutbox([...readOutbox(), d])
      flushOutbox()
      return p
    },
    signDocument: (docId, sig) => {
      const s = useStore.getState()
      const d = s.documents.find((x) => x.id === docId)!
      const ts = Date.now()
      const full: Signature = { ...sig, empId: s.meId, ts, hash: sha256(`${d.hash}|${s.meId}|${ts}|${sha256(sig.image)}`) }
      applying = true
      useStore.setState({ documents: s.documents.map((x) => (x.id === docId ? { ...x, signatures: [...x.signatures, full] } : x)) })
      takeSnapshot()
      applying = false
      const { client, companyId } = cloud.getState()
      client?.rpc('sign_document', { c: companyId, doc_id: docId, signature: full }).then(({ data, error }) => {
        if (error) return report(error.message)
        applyRemoteRecord('UPDATE', { collection: 'documents', id: docId, data: data as HRDocument })
      })
      return full
    },
    importPunches: async (drafts) => {
      const { client, companyId } = cloud.getState()
      const sorted = [...drafts].sort((a, b) => a.ts - b.ts)
      for (let i = 0; i < sorted.length; i += 400) {
        const { error } = await client!.rpc('clock_import', { c: companyId, ps: sorted.slice(i, i + 400).map(punchToRow) })
        if (error) throw new Error(error.message)
      }
      await loadAll()
      return sorted.length
    },
    tamper: () => {},
    topUp: () => {},
  })
}

function teardown() {
  channel?.unsubscribe()
  unsubStore?.()
  ls.set('aura-company', null)
  useStore.getState().reset()
  cloud.setState({ status: 'auth', companyId: undefined, role: undefined, employeeId: undefined, members: [] })
  location.reload()
}

export async function signOut() {
  await cloud.getState().client?.auth.signOut()
  teardown()
}

/* ------------------------------------------------------------------ */
/* Alta de empresa e invitaciones                                      */
/* ------------------------------------------------------------------ */
export async function createCompany(companyName: string, emp: Employee, legal: Partial<typeof COMPANY>) {
  const { client } = cloud.getState()
  if (!client) throw new Error('Sin servidor')
  const [pub, pay] = toRows('employees', emp as unknown as Record<string, unknown>)
  const { error } = await client.rpc('create_company', { company_name: companyName, employee: pub.data, payroll: pay.data, company_data: { ...COMPANY, ...legal, name: companyName } })
  if (error) throw new Error(error.message)
  await afterLogin()
}

export async function createInvite(employeeId: string, role: Role = 'employee') {
  const { client, companyId } = cloud.getState()
  if (!client || !companyId) throw new Error('Sin servidor')
  const { data, error } = await client.rpc('create_invite', { c: companyId, employee_id: employeeId, invite_role: role })
  if (error) throw new Error(error.message)
  return { code: data as string, link: `${location.origin}${location.pathname}#unirse-${data}` }
}

export async function joinWithCode(code: string) {
  ls.set('aura-invite', code.trim().toUpperCase())
  await afterLogin()
}
