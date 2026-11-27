// Bot de fichaje por WhatsApp (lógica pura, sin dependencias: se prueba en Node y se ejecuta en Deno).
// Flujo: la persona escribe «entrada» → el bot pide la ubicación con un botón → la persona la comparte →
// se comprueba la geovalla y se sella el fichaje en la misma cadena que la app (método «whatsapp»).

export type PunchType = 'in' | 'out' | 'break_start' | 'break_end'
export type Person = { company_id: string; emp_id: string; name: string; zone_id: string | null; company_name: string }
export type Zone = { id: string; name: string; lat: number; lng: number; radius: number }
export type Punch = { type: PunchType; ts: number; seq?: number; hash?: string }
export type Session = { phone: string; company_id: string; emp_id: string; pending: string | null; expires_at: string | null }

export type Out =
  | { kind: 'text'; text: string }
  | { kind: 'buttons'; text: string; buttons: { id: string; title: string }[] }
  | { kind: 'location'; text: string }

export interface Deps {
  find(phone: string): Promise<Person[]>
  zones(company: string): Promise<Zone[]>
  remoteToday(company: string, emp: string): Promise<boolean>
  punchesSince(company: string, emp: string, since: number): Promise<Punch[]>
  clock(company: string, emp: string, p: Record<string, unknown>): Promise<{ seq: number; hash: string; ts: number }>
  getSession(phone: string): Promise<Session | null>
  setSession(s: Session | null, phone: string): Promise<void>
  requireLocation(company: string): Promise<boolean>
  now(): number
}

export type Incoming = { from: string; text?: string; buttonId?: string; location?: { latitude: number; longitude: number } }

const LABEL: Record<PunchType, string> = { in: 'Entrada', out: 'Salida', break_start: 'Inicio de pausa', break_end: 'Fin de pausa' }
const EMOJI: Record<PunchType, string> = { in: '🟢', out: '🔴', break_start: '☕', break_end: '▶️' }
const TZ = 'Europe/Madrid'

export const norm = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const madridDay = (ts: number) => new Date(ts).toLocaleDateString('sv-SE', { timeZone: TZ })
const hhmm = (ts: number) => new Date(ts).toLocaleTimeString('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const hm = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`

export function parseIntent(t: string): PunchType | 'next' | 'status' | 'help' | 'cancel' | null {
  const n = norm(t)
  if (!n) return null
  if (/^(ayuda|help|menu|hola|buenas|buenos dias|buenas tardes|info)\b/.test(n)) return 'help'
  if (/(cancel|olvidalo|nada)/.test(n)) return 'cancel'
  if (/(cuanto|horas|llevo|estado|resumen|balance)/.test(n)) return 'status'
  if (/(fin.*(pausa|descanso)|vuelvo|vuelta|reanud|termino.*pausa)/.test(n)) return 'break_end'
  if (/(pausa|descanso|cafe|comer|almuerzo|break)/.test(n)) return 'break_start'
  if (/(salida|salgo|me voy|fin de jornada|termino|acabo|out|adios|hasta manana)/.test(n)) return 'out'
  if (/(entrada|entro|empiezo|llego|llegue|inicio|comienzo|\bin\b)/.test(n)) return 'in'
  if (/^(fichar|fichaje|ficha|fichame|registrar)\b/.test(n)) return 'next'
  return null
}

export function stateOf(ps: Punch[]): 'none' | 'working' | 'break' | 'done' {
  const last = [...ps].sort((a, b) => a.ts - b.ts).at(-1)
  if (!last) return 'none'
  return last.type === 'out' ? 'done' : last.type === 'break_start' ? 'break' : 'working'
}

export function workedMinutes(ps: Punch[], now: number) {
  const s = [...ps].sort((a, b) => a.ts - b.ts)
  let total = 0
  let from: number | null = null
  for (const p of s) {
    if (p.type === 'in' || p.type === 'break_end') from = p.ts
    else if (from != null) {
      total += p.ts - from
      from = null
    }
  }
  if (from != null) total += now - from
  return total / 60000
}

const allowed = (st: ReturnType<typeof stateOf>): PunchType[] => (st === 'working' ? ['out', 'break_start'] : st === 'break' ? ['break_end', 'out'] : ['in'])
const menu = (st: ReturnType<typeof stateOf>) => allowed(st).map((t) => ({ id: t, title: `${EMOJI[t]} ${LABEL[t]}` }))

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000
  const r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export async function handle(msg: Incoming, d: Deps): Promise<Out[]> {
  const people = await d.find(msg.from)
  if (!people.length) return [{ kind: 'text', text: 'Hola 👋 Este número no está vinculado a ninguna persona en Aura. Pide a tu responsable que añada tu móvil en tu ficha (Personas → editar → Teléfono) y vuelve a escribir.' }]
  const session = await d.getSession(msg.from)
  // Si el móvil está en varias empresas, se usa la última con la que habló (o la primera)
  const me = people.find((p) => p.company_id === session?.company_id) ?? people[0]
  const now = d.now()
  const today = (await d.punchesSince(me.company_id, me.emp_id, now - 36 * 3600e3)).filter((p) => madridDay(p.ts) === madridDay(now))
  const st = stateOf(today)
  const first = me.name.split(' ')[0]

  const doClock = async (type: PunchType, loc?: { latitude: number; longitude: number }): Promise<Out[]> => {
    if (!allowed(st).includes(type)) {
      const why = st === 'working' ? 'ya estás trabajando' : st === 'break' ? 'estás en pausa' : st === 'done' ? 'ya cerraste la jornada' : 'aún no has fichado la entrada'
      return [{ kind: 'buttons', text: `No puedo registrar «${LABEL[type].toLowerCase()}» porque ${why}. ¿Qué quieres hacer?`, buttons: menu(st) }]
    }
    const flags: string[] = []
    let zone: Zone | undefined
    let dist: number | undefined
    let remote = false
    if (loc) {
      const zones = await d.zones(me.company_id)
      for (const z of zones) {
        const dd = distanceM({ lat: loc.latitude, lng: loc.longitude }, z)
        if (dist == null || dd < dist) {
          dist = dd
          if (dd <= z.radius + 60) zone = z
        }
      }
      if (!zone) {
        remote = await d.remoteToday(me.company_id, me.emp_id)
        if (!remote) flags.push('fuera_de_zona')
      }
      flags.push('ubicacion_whatsapp')
    } else flags.push('sin_ubicacion')
    const r = await d.clock(me.company_id, me.emp_id, {
      type,
      ts: now,
      lat: loc ? String(+loc.latitude.toFixed(6)) : null,
      lng: loc ? String(+loc.longitude.toFixed(6)) : null,
      acc: null,
      zone: loc ? (zone?.id ?? '∅') : '',
      remote,
      flags,
    })
    await d.setSession({ phone: msg.from, company_id: me.company_id, emp_id: me.emp_id, pending: null, expires_at: null }, msg.from)
    const where = zone ? `en ${zone.name}` : remote ? 'en teletrabajo' : loc ? `fuera de zona${dist != null ? ` (a ${dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(1) + ' km'} del centro más cercano)` : ''}` : 'sin ubicación'
    const worked = workedMinutes([...today, { type, ts: now }], now)
    const extra = type === 'out' ? `\nHoy has trabajado ${hm(worked)}. ¡Buen descanso, ${first}!` : type === 'in' ? `\n¡Buena jornada, ${first}!` : type === 'break_start' ? '\nEscribe «vuelvo» cuando retomes.' : `\nLlevas ${hm(worked)} hoy.`
    return [{ kind: 'text', text: `${EMOJI[type]} *${LABEL[type]} registrada a las ${hhmm(now)}* ${where}.\nSello #${r.seq} · ${r.hash.slice(0, 10)}…${extra}${flags.includes('fuera_de_zona') ? '\n⚠️ Quedará marcada para revisión por estar fuera de tu centro.' : ''}` }]
  }

  const live = (x: Session | null) => !!x?.pending && !!x.expires_at && new Date(x.expires_at).getTime() > now
  const save = (pending: string | null) => d.setSession({ phone: msg.from, company_id: me.company_id, emp_id: me.emp_id, pending, expires_at: pending ? new Date(now + 5 * 60000).toISOString() : null }, msg.from)

  // 1) Ubicación compartida: completa el fichaje pendiente; si no lo hay, pregunta qué registrar
  if (msg.location) {
    if (live(session) && !session!.pending!.startsWith('loc:')) return doClock(session!.pending as PunchType, msg.location)
    await save(`loc:${msg.location.latitude},${msg.location.longitude}`)
    return [{ kind: 'buttons', text: '📍 Ubicación recibida. ¿Qué quieres registrar?', buttons: menu(st) }]
  }
  const savedLoc = live(session) && session!.pending!.startsWith('loc:') ? (([la, ln]) => ({ latitude: +la, longitude: +ln }))(session!.pending!.slice(4).split(',')) : undefined

  // 2) Texto o botón
  const intent = msg.buttonId ? (msg.buttonId as PunchType) : parseIntent(msg.text ?? '')
  if (intent === 'cancel') {
    await save(null)
    return [{ kind: 'text', text: 'Hecho, no registro nada.' }]
  }
  if (intent === 'status') {
    const w = workedMinutes(today, now)
    const txt = st === 'none' ? 'Hoy aún no has fichado.' : `Hoy llevas ${hm(w)}${st === 'break' ? ' (ahora en pausa)' : st === 'done' ? ' y tu jornada está cerrada' : ''}.`
    return [{ kind: 'buttons', text: `${txt}\nFichajes de hoy: ${today.length ? today.sort((a, b) => a.ts - b.ts).map((p) => `${LABEL[p.type].toLowerCase()} ${hhmm(p.ts)}`).join(', ') : '—'}`, buttons: menu(st) }]
  }
  if (intent && intent !== 'help') {
    const type = intent === 'next' ? allowed(st)[0] : intent
    if (savedLoc) return doClock(type, savedLoc)
    if (await d.requireLocation(me.company_id)) {
      if (!allowed(st).includes(type)) return doClock(type)
      await save(type)
      return [{ kind: 'location', text: `${EMOJI[type]} Para registrar tu *${LABEL[type].toLowerCase()}*, comparte tu ubicación actual con el botón de abajo.` }]
    }
    return doClock(type)
  }
  // 3) Saludo / ayuda / mensaje no reconocido
  const status = st === 'none' ? 'Aún no has fichado hoy.' : st === 'working' ? `Estás trabajando · ${hm(workedMinutes(today, now))}.` : st === 'break' ? 'Estás en pausa.' : 'Tu jornada de hoy está cerrada.'
  return [{ kind: 'buttons', text: `Hola ${first} 👋 Soy el asistente de fichaje de ${me.company_name}.\n${status}\n\nTambién puedes escribir «entrada», «pausa», «vuelvo», «salida» o «¿cuántas horas llevo?».`, buttons: menu(st) }]
}

/** Convierte el webhook de Meta en mensajes entrantes. */
export function parseWebhook(body: unknown): Incoming[] {
  const out: Incoming[] = []
  const entries = (body as { entry?: { changes?: { value?: { messages?: unknown[] } }[] }[] })?.entry ?? []
  for (const e of entries)
    for (const c of e.changes ?? [])
      for (const m of (c.value?.messages ?? []) as Record<string, any>[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
        out.push({
          from: String(m.from),
          text: m.text?.body,
          buttonId: m.interactive?.button_reply?.id ?? m.button?.payload,
          location: m.location ? { latitude: Number(m.location.latitude), longitude: Number(m.location.longitude) } : undefined,
        })
      }
  return out
}

/** Mensaje de la API de WhatsApp Cloud para cada respuesta. */
export function toWhatsApp(to: string, o: Out) {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to }
  if (o.kind === 'text') return { ...base, type: 'text', text: { body: o.text, preview_url: false } }
  if (o.kind === 'location') return { ...base, type: 'interactive', interactive: { type: 'location_request_message', body: { text: o.text }, action: { name: 'send_location' } } }
  return { ...base, type: 'interactive', interactive: { type: 'button', body: { text: o.text.slice(0, 1024) }, action: { buttons: o.buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) } } }
}
