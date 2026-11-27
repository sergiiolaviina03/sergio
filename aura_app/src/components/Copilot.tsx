import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, CornerDownLeft, Mic, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNav, go } from '../lib/nav'
import { parse, SUGGESTIONS, type Intent } from '../lib/copilot'
import { useStore } from '../store'
import { byDay, findIssues, plannedMin, rangeStats, summarize, timeOffUsage, workingDays, absenceOn } from '../lib/attendance'
import { dayKey, fmt, hm, monthKey, parseDay, cap } from '../lib/time'
import { HOLIDAYS, TIME_OFF_TYPES } from '../data/seed'
import { annualNet, eur, payslip } from '../lib/payroll'
import { verify } from '../lib/ledger'
import { startClock, LABEL } from './ClockFlow'
import { Avatar, cx, toast } from './ui'
import { useSignFlow } from '../pages/Documents'
import { canSpeak, speak } from '../lib/platform'
import { Volume2 } from 'lucide-react'
import { startOfMonth, startOfWeek, endOfWeek, endOfMonth } from 'date-fns'

type Action = { label: string; run: () => void; primary?: boolean }
type Msg = { id: number; role: 'user' | 'ai'; text: string; actions?: Action[]; extra?: ReactNode }

const PAGE_NAMES: Record<string, string> = { home: 'Inicio', clock: 'Mi jornada', timesheet: 'Hoja de horas', timeoff: 'Ausencias', payroll: 'Nóminas', team: 'Equipo en vivo', inbox: 'Bandeja', ledger: 'Registro sellado', settings: 'Ajustes', kiosk: 'Modo quiosco' }

export function respond(intent: Intent): Omit<Msg, 'id' | 'role'> {
  const s = useStore.getState()
  const me = s.employees.find((e) => e.id === s.meId)!
  const now = new Date()
  const days = byDay(s.punches, me.id)
  const today = summarize(days.get(dayKey(now)) ?? [], now.getTime())
  const first = me.name.split(' ')[0]

  switch (intent.kind) {
    case 'clock': {
      const valid =
        (intent.type === 'in' && (today.state === 'none' || today.state === 'done')) ||
        (intent.type === 'out' && (today.state === 'working' || today.state === 'break')) ||
        (intent.type === 'break_start' && today.state === 'working') ||
        (intent.type === 'break_end' && today.state === 'break')
      if (!valid) {
        const why = today.state === 'working' ? 'ya estás trabajando' : today.state === 'break' ? 'estás en pausa' : today.state === 'done' ? 'tu jornada está cerrada' : 'aún no has fichado la entrada'
        return { text: `No puedo registrar «${LABEL[intent.type].toLowerCase()}» porque ${why}.`, actions: suggestedClock(today.state) }
      }
      setTimeout(() => startClock(intent.type, 'copilot'), 250)
      return { text: `Hecho. Verifico tu ubicación y sello la ${LABEL[intent.type].toLowerCase()} en el registro.` }
    }
    case 'leave_time': {
      const planned = plannedMin(me, now, s.requests)
      if (!planned) return { text: `Hoy no tienes jornada planificada${HOLIDAYS[dayKey(now)] ? ` (${HOLIDAYS[dayKey(now)]})` : ''}. Disfruta 🌿` }
      if (today.state === 'none') return { text: `Aún no has fichado. Si entras ahora, cuadrarías tu jornada de ${hm(planned)} a las ${fmt(now.getTime() + (planned + me.breakMin) * 60000, 'HH:mm')} (contando ${me.breakMin} min de pausa).`, actions: [{ label: 'Fichar entrada', primary: true, run: () => startClock('in', 'copilot') }] }
      const left = planned - today.worked
      if (left <= 0) return { text: `Ya has cumplido tu jornada: llevas ${hm(today.worked)}, ${hm(-left)} por encima. Puedes irte cuando quieras 🎉`, actions: [{ label: 'Fichar salida', primary: true, run: () => startClock('out', 'copilot') }] }
      const extraBreak = today.breaks < me.breakMin && today.state === 'working' ? me.breakMin - today.breaks : 0
      return { text: `Te quedan ${hm(left)}. Si sigues sin parar, cuadras a las ${fmt(now.getTime() + left * 60000, 'HH:mm')}${extraBreak ? `; con la pausa de comida que te falta (~${Math.round(extraBreak)} min), a las ${fmt(now.getTime() + (left + extraBreak) * 60000, 'HH:mm')}` : ''}.` }
    }
    case 'hours': {
      const ranges = { today: [now, now], week: [startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })], month: [startOfMonth(now), endOfMonth(now)] } as const
      const [a, b] = ranges[intent.range]
      const st = rangeStats(me, days, s.requests, a, b)
      const label = { today: 'hoy', week: 'esta semana', month: 'este mes' }[intent.range]
      return { text: `${cap(label)} llevas ${hm(st.worked)} de ${hm(st.planned)} previstas. Balance: ${hm(st.balance, true)}.${st.overtime > 30 ? ` Incluye ${hm(st.overtime)} por encima de tu jornada.` : ''}` }
    }
    case 'bank': {
      const st = rangeStats(me, days, s.requests, startOfMonth(new Date(now.getFullYear(), now.getMonth() - 2, 1)), now)
      return { text: `Tu banco de horas está en ${hm(st.balance, true)} (últimos 3 meses). ${st.balance > 60 ? 'Podrías compensarlo saliendo antes un viernes.' : st.balance < -60 ? 'Vas algo por debajo; te aviso si se acerca al límite.' : 'Vas perfectamente cuadrado.'}`, actions: [{ label: 'Ver hoja de horas', run: () => go('timesheet') }] }
    }
    case 'leave_balance': {
      const use = timeOffUsage(me.id, s.requests, now.getFullYear())
      const types = intent.typeId ? TIME_OFF_TYPES.filter((t) => t.id === intent.typeId) : TIME_OFF_TYPES
      const parts = types.map((t) => (t.allowance == null ? `${t.emoji} ${t.name}: sin límite` : `${t.emoji} ${t.name}: ${t.allowance - use[t.id].used - use[t.id].pending} ${t.unit} disponibles${use[t.id].pending ? ` (${use[t.id].pending} pendientes)` : ''}`))
      return { text: parts.join('\n'), actions: [{ label: 'Abrir ausencias', run: () => go('timeoff') }] }
    }
    case 'leave_request': {
      const type = TIME_OFF_TYPES.find((t) => t.id === intent.typeId)!
      const a = parseDay(intent.from)
      const b = parseDay(intent.to)
      const wd = workingDays(a, b)
      if (!wd.length && !intent.hours) return { text: `Entre el ${fmt(a, "d 'de' MMMM")} y el ${fmt(b, "d 'de' MMMM")} no hay días laborables (fin de semana o festivo). No hace falta pedir nada 😉` }
      const use = timeOffUsage(me.id, s.requests, a.getFullYear())
      const need = intent.hours ?? wd.length
      const left = type.allowance == null ? Infinity : type.allowance - use[type.id].used - use[type.id].pending
      const team = s.employees.filter((e) => e.team === me.team && e.id !== me.id)
      const clash = team.filter((e) => wd.some((d) => absenceOn(e.id, dayKey(d), s.requests)) || s.requests.some((r) => r.empId === e.id && r.status === 'pending' && r.from <= intent.to && r.to >= intent.from))
      const coverage = Math.round(((team.length - clash.length) / Math.max(1, team.length)) * 100)
      const range = intent.from === intent.to ? fmt(a, "EEEE d 'de' MMMM") : `${fmt(a, "d MMM")} → ${fmt(b, "d MMM")}`
      if (need > left) return { text: `Te pediría ${need} ${type.unit} de ${type.name.toLowerCase()} (${range}), pero solo te quedan ${left}.` }
      return {
        text: `${type.emoji} ${type.name} · ${range}\n${intent.hours ? `${intent.hours} h` : `${wd.length} día${wd.length > 1 ? 's' : ''} laborable${wd.length > 1 ? 's' : ''}`}${type.allowance != null ? ` · te quedarán ${left - need} ${type.unit}` : ''}\nCobertura del equipo: ${coverage}%${clash.length ? ` (${clash.map((e) => e.name.split(' ')[0]).join(', ')} también fuera)` : ' · sin solapamientos'}`,
        actions: [
          {
            label: 'Enviar solicitud',
            primary: true,
            run: () => {
              useStore.getState().requestTimeOff({ typeId: type.id, from: intent.from, to: intent.to, hours: intent.hours })
              toast({ title: 'Solicitud enviada', body: `${type.name} · ${range}`, tone: 'ai' })
            },
          },
          { label: 'Editar', run: () => go('timeoff') },
        ],
      }
    }
    case 'payroll': {
      const m = monthKey(now)
      const st = rangeStats(me, days, s.requests, startOfMonth(now), now)
      const p = payslip(me, m, { overtimeMin: Math.max(0, st.overtime - 60) })
      if (intent.raise || intent.salary) {
        const target = intent.salary ?? me.salary + (intent.raise ?? 0)
        const a0 = annualNet(me, me.salary)
        const a1 = annualNet(me, target)
        return { text: `Con ${eur(target, 0)} brutos/año cobrarías ~${eur(a1.neto / 12, 0)} netos/mes de media (${eur(a1.neto, 0)}/año).\nFrente a hoy: ${a1.neto - a0.neto >= 0 ? '+' : ''}${eur(a1.neto - a0.neto, 0)} netos/año (${Math.round(((a1.neto - a0.neto) / Math.max(1, target - me.salary)) * 100)}% de la subida llega a tu bolsillo).\nCoste para la empresa: ${eur(a1.coste, 0)}.`, actions: [{ label: 'Abrir simulador', run: () => go('payroll') }] }
      }
      return { text: `Tu nómina de ${fmt(now, 'MMMM')} sale aprox. en ${eur(p.neto)} netos (bruto ${eur(p.bruto)}, IRPF ${p.irpf}%).${p.devengos.some((d) => d.concept.startsWith('Horas')) ? ' Incluye horas extra de este mes.' : ''}`, actions: [{ label: 'Ver nómina', primary: true, run: () => go('payroll') }] }
    }
    case 'who': {
      const k = dayKey(now)
      const rows = s.employees.filter((e) => e.id !== me.id).map((e) => {
        const sm = summarize(byDay(s.punches, e.id).get(k) ?? [], now.getTime())
        const last = sm.punches.at(-1)
        return { e, sm, remote: !!last?.remote, off: absenceOn(e.id, k, s.requests) }
      })
      const pick = intent.what === 'remote' ? rows.filter((r) => r.remote && (r.sm.state === 'working' || r.sm.state === 'break')) : intent.what === 'off' ? rows.filter((r) => r.off || r.sm.state === 'none') : rows.filter((r) => !r.remote && (r.sm.state === 'working' || r.sm.state === 'break'))
      const title = { remote: 'Teletrabajando ahora', off: 'Ausentes o sin fichar', in: 'En la oficina ahora', out: '' }[intent.what]
      return {
        text: `${title}: ${pick.length}`,
        extra: (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pick.map(({ e, off, sm }) => (
              <span key={e.id} className="chip bg-sunken border border-line text-ink py-1 pl-1 pr-2">
                <Avatar emp={e} size={18} /> {e.name.split(' ')[0]}
                {off && <span className="text-muted">· {TIME_OFF_TYPES.find((t) => t.id === off.typeId)?.emoji}</span>}
                {sm.state === 'break' && <span className="text-warn">· pausa</span>}
              </span>
            ))}
          </div>
        ),
        actions: [{ label: 'Ver mapa del equipo', run: () => go('team') }],
      }
    }
    case 'issues': {
      const issues = findIssues(me, days, now).slice(0, 4)
      if (!issues.length) return { text: `Todo en orden, ${first}. No veo fichajes incompletos ni incumplimientos de descansos.` }
      const fixable = issues.find((i) => i.kind === 'missing_out' && i.suggestTs)
      return {
        text: `He revisado tus fichajes y encontré ${issues.length} cosa${issues.length > 1 ? 's' : ''}:\n` + issues.map((i) => `• ${cap(fmt(parseDay(i.day), 'EEE d MMM'))}: ${i.title}`).join('\n'),
        actions: [
          ...(fixable
            ? [{ label: `Proponer salida ${fmt(fixable.suggestTs!, 'HH:mm')} (${fmt(parseDay(fixable.day), 'EEE d')})`, primary: true, run: () => { useStore.getState().requestCorrection({ type: 'out', ts: fixable.suggestTs!, reason: 'Olvido de fichaje · propuesto por el copiloto' }); toast({ title: 'Corrección enviada a aprobación', body: 'Quedará registrada como un nuevo asiento, sin borrar nada.', tone: 'ai' }) } }]
            : []),
          { label: 'Ver hoja de horas', run: () => go('timesheet') },
        ],
      }
    }
    case 'docs': {
      const pend = s.documents.filter((d) => d.requireSignature && d.audience.includes(me.id) && !d.signatures.some((x) => x.empId === me.id))
      if (!pend.length) return { text: 'No tienes documentos pendientes de firma ✅', actions: [{ label: 'Ver mis documentos', run: () => go('documents') }] }
      return {
        text: `Tienes ${pend.length} documento${pend.length > 1 ? 's' : ''} por firmar:\n` + pend.map((d) => `• ${d.title}${d.mandatory ? ' (obligatorio)' : ''}${d.due ? ` · vence ${fmt(parseDay(d.due), 'd MMM')}` : ''}`).join('\n'),
        actions: [{ label: 'Firmar ahora', primary: true, run: () => { useNav.getState().setCopilot(false); useSignFlow.getState().open(pend[0].id) } }, { label: 'Ver todos', run: () => go('documents') }],
      }
    }
    case 'expense': {
      if (intent.amount) {
        const cat = /taxi|cabify|uber|tren|renfe|metro|bus|parking/.test((intent.merchant ?? '').toLowerCase()) ? 'transporte' : /comida|restaur|menu|cafe|bar/.test((intent.merchant ?? '').toLowerCase()) ? 'comida' : 'otros'
        return {
          text: `Registro un gasto de ${eur(intent.amount)}${intent.merchant ? ` en ${intent.merchant}` : ''} con fecha de hoy. Recuerda adjuntar el ticket desde Gastos si lo tienes.`,
          actions: [{ label: 'Enviar a aprobación', primary: true, run: () => { useStore.getState().addExpense({ date: dayKey(new Date()), merchant: cap(intent.merchant ?? 'Gasto'), amount: intent.amount!, category: cat as 'otros', flags: ['Sin justificante adjunto'] }); toast({ title: 'Gasto registrado', tone: 'ai' }) } }, { label: 'Abrir gastos', run: () => go('expenses') }],
        }
      }
      const mine = s.expenses.filter((x) => x.empId === me.id)
      const pend = mine.filter((x) => x.status === 'pending' || x.status === 'approved').reduce((a, x) => a + x.amount, 0)
      return { text: `Tienes ${eur(pend)} en gastos pendientes de reembolso. Para añadir uno, haz una foto al ticket en Gastos o dime «gasto de 12 € en taxi».`, actions: [{ label: 'Abrir gastos', run: () => go('expenses') }] }
    }
    case 'theme':
      s.setSettings({ theme: intent.value })
      return { text: intent.value === 'dark' ? 'Modo oscuro activado 🌙' : 'Modo claro activado ☀️' }
    case 'verify': {
      const r = verify(s.punches)
      return { text: r.ok ? `Registro íntegro ✅ He recalculado ${r.checked.toLocaleString('es-ES')} sellos SHA-256 encadenados en ${r.ms.toFixed(0)} ms. Ningún fichaje ha sido alterado.` : `⚠️ Cadena rota en el asiento #${r.brokenAt}: ${r.reason}.`, actions: [{ label: 'Abrir registro sellado', run: () => go('ledger') }] }
    }
    case 'nav':
      setTimeout(() => go(intent.page), 200)
      return { text: `Abriendo ${PAGE_NAMES[intent.page]}…` }
    case 'help':
      return { text: `Hola ${first} 👋 Puedo fichar por ti, calcular cuándo cuadras tu jornada, pedir ausencias, revisar errores en tus fichajes, estimar tu nómina y decirte quién está en la oficina. Escribe como hablarías.` }
    default:
      return { text: 'No estoy seguro de haberte entendido. Prueba con algo como estos:', actions: SUGGESTIONS.slice(0, 3).map((q) => ({ label: q, run: () => useNav.getState().setCopilot(true, q) })) }
  }
}

function suggestedClock(state: string): Action[] {
  if (state === 'working') return [{ label: 'Fichar salida', run: () => startClock('out', 'copilot') }, { label: 'Pausa', run: () => startClock('break_start', 'copilot') }]
  if (state === 'break') return [{ label: 'Volver de la pausa', run: () => startClock('break_end', 'copilot') }]
  return [{ label: 'Fichar entrada', run: () => startClock('in', 'copilot') }]
}

export function Copilot() {
  const { copilot: open, setCopilot, seed } = useNav()
  const [q, setQ] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const [listening, setListening] = useState(false)
  // Dictado por voz con la Web Speech API del navegador (gratuita, sin servidor propio)
  const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition
  const listen = () => {
    if (!SR) return
    const r = new SR()
    r.lang = 'es-ES'
    r.interimResults = true
    r.onresult = (e) => {
      const res = e.results[e.results.length - 1]
      setQ(res[0].transcript)
      if (res.isFinal) {
        setListening(false)
        ask(res[0].transcript)
      }
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    setListening(true)
    r.start()
  }
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCopilot(!useNav.getState().copilot)
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [setCopilot])

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 60)
    if (open && seed) {
      ask(seed)
      useNav.setState({ seed: undefined })
    }
  }, [open, seed]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scroller.current?.scrollTo({ top: 1e6, behavior: 'smooth' })
  }, [msgs, typing])

  const ask = (text: string) => {
    if (!text.trim()) return
    const id = Date.now()
    setMsgs((m) => [...m, { id, role: 'user', text }])
    setQ('')
    setTyping(true)
    const reply = respond(parse(text))
    setTimeout(() => {
      setTyping(false)
      setMsgs((m) => [...m, { id: id + 1, role: 'ai', ...reply }])
    }, 380 + Math.min(500, reply.text.length * 3))
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:pt-[10vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[3px]" onClick={() => setCopilot(false)} />
          <motion.div
            className="relative w-full max-w-[640px] card shadow-pop overflow-hidden aurora-border flex flex-col max-h-[80vh]"
            initial={{ y: -12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -8, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <form
              className="flex items-center gap-3 px-4 h-14 border-b border-line"
              onSubmit={(e) => {
                e.preventDefault()
                ask(q)
              }}
            >
              <Sparkles size={18} className="text-brand shrink-0" />
              <input ref={input} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pídeselo a Aura: «ficha mi entrada», «vacaciones del 22 al 26 de diciembre»…" className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted" />
              {SR && !q && (
                <button type="button" onClick={listen} className={cx('h-8 w-8 rounded-lg grid place-items-center transition', listening ? 'bg-bad text-white animate-pulse' : 'hover:bg-sunken text-muted')} aria-label="Dictar por voz">
                  <Mic size={16} />
                </button>
              )}
              {q ? (
                <button className="h-8 w-8 rounded-lg bg-brand text-white grid place-items-center" aria-label="Enviar">
                  <ArrowUp size={16} />
                </button>
              ) : (
                <button type="button" onClick={() => setCopilot(false)} className="h-8 w-8 rounded-lg hover:bg-sunken grid place-items-center text-muted" aria-label="Cerrar">
                  <X size={16} />
                </button>
              )}
            </form>
            <div ref={scroller} className="overflow-auto p-4 space-y-3 min-h-[120px]">
              {!msgs.length && (
                <div>
                  <div className="text-xs font-medium text-muted mb-2">Prueba a decir</div>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => ask(s)} className="text-left text-sm px-3 py-2 rounded-xl hover:bg-sunken border border-transparent hover:border-line transition flex items-center gap-2 group">
                        <CornerDownLeft size={13} className="text-muted group-hover:text-brand" /> {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {m.role === 'user' ? (
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-ink text-surface px-3.5 py-2 text-sm">{m.text}</div>
                  ) : (
                    <div className="max-w-[92%] flex gap-2.5">
                      <div className="h-7 w-7 rounded-full shrink-0 grid place-items-center text-white" style={{ background: 'linear-gradient(135deg,#8b5cf6,#22d3ee)' }}>
                        <Sparkles size={13} />
                      </div>
                      <div>
                        <div className="flex items-start gap-1"><Typed text={m.text} />{canSpeak && <button onClick={() => speak(m.text)} className="mt-1 shrink-0 h-6 w-6 rounded-md grid place-items-center text-muted hover:text-brand hover:bg-sunken" aria-label="Escuchar"><Volume2 size={13} /></button>}</div>
                        {m.extra}
                        {m.actions && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {m.actions.map((a) => (
                              <button
                                key={a.label}
                                onClick={() => {
                                  a.run()
                                  if (a.primary) setMsgs((x) => x.map((y) => (y.id === m.id ? { ...y, actions: undefined } : y)))
                                }}
                                className={cx('btn h-8 text-xs', a.primary ? 'bg-brand text-white' : 'btn-outline')}
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
              {typing && (
                <div className="flex gap-1 pl-10">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-brand" animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }} />
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-line text-[11px] text-muted flex items-center gap-3">
              <span><kbd className="font-mono">Ctrl K</kbd> abrir/cerrar</span>
              <span><kbd className="font-mono">Esc</kbd> salir</span>
              {SR && <span className="hidden sm:inline">🎙️ Puedes hablarle</span>}
              <span className="ml-auto">Procesado en tu dispositivo</span>
            </div>
          </motion.div>
          <EscClose onClose={() => setCopilot(false)} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type SpeechRec = { lang: string; interimResults: boolean; start: () => void; onresult: (e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void; onend: () => void; onerror: () => void }

function EscClose({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])
  return null
}

function Typed({ text }: { text: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let i = 0
    const t = setInterval(() => {
      i += Math.max(1, Math.round(text.length / 40))
      setN(i)
      if (i >= text.length) clearInterval(t)
    }, 16)
    return () => clearInterval(t)
  }, [text])
  return <div className="text-sm whitespace-pre-line leading-relaxed pt-1">{text.slice(0, n)}</div>
}
