import { ArrowRight, CalendarHeart, PartyPopper, Plane, Sparkles, TriangleAlert, Users, Wallet, Inbox } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { addDays, startOfWeek, startOfMonth } from 'date-fns'
import { useMe, useStore } from '../store'
import { useDays, useNow } from '../lib/hooks'
import { byDay, findIssues, plannedMin, rangeStats, summarize, absenceOn, timeOffUsage } from '../lib/attendance'
import { cap, dayKey, fmt, hm, hShort, monthKey, parseDay } from '../lib/time'
import { ClockOrb } from '../components/ClockOrb'
import { AiNote, Avatar, Section, cx } from '../components/ui'
import { go, useNav } from '../lib/nav'
import { HOLIDAYS, TIME_OFF_TYPES } from '../data/seed'
import { eur, payslip } from '../lib/payroll'
import { useInboxCount } from '../components/Layout'
import { usePendingDocs, useSignFlow, dueLabel } from './Documents'
import { FileSignature } from 'lucide-react'

export function HomePage() {
  const me = useMe()
  const s = useStore()
  const days = useDays(me.id)
  const now = useNow(30000)
  const d = new Date(now)
  const h = d.getHours()
  const greet = h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
  const issues = useMemo(() => findIssues(me, days, d), [days]) // eslint-disable-line react-hooks/exhaustive-deps
  const week = rangeStats(me, days, s.requests, startOfWeek(d, { weekStartsOn: 1 }), d, now)
  const month = rangeStats(me, days, s.requests, startOfMonth(d), d, now)
  const inbox = useInboxCount()
  const docs = usePendingDocs()
  const openSign = useSignFlow((x) => x.open)
  const today = summarize(days.get(dayKey(d)) ?? [], now)
  const vac = timeOffUsage(me.id, s.requests, d.getFullYear()).vac
  const slip = payslip(me, monthKey(d), { overtimeMin: Math.max(0, month.overtime - 60) })

  const brief = useMemo(() => {
    const parts: string[] = []
    const planned = plannedMin(me, d, s.requests)
    if (HOLIDAYS[dayKey(d)]) parts.push(`Hoy es festivo (${HOLIDAYS[dayKey(d)]}).`)
    else if (!planned) parts.push('Hoy no tienes jornada planificada.')
    else if (today.state === 'none') parts.push(`Aún no has fichado. Tu horario empieza a las ${me.start}${me.remoteDays.includes(((d.getDay() + 6) % 7) + 1) ? ' y hoy toca teletrabajo' : ''}.`)
    else if (today.state === 'working') parts.push(`Llevas ${hm(today.worked)}; cuadras a las ${fmt(now + Math.max(0, planned - today.worked) * 60000, 'HH:mm')}.`)
    else if (today.state === 'done') parts.push(`Jornada cerrada con ${hm(today.worked)}.`)
    if (Math.abs(week.balance) > 30) parts.push(`Esta semana vas ${hm(week.balance, true)} respecto a lo previsto.`)
    if (issues.some((i) => i.severity === 'high')) parts.push(`Tienes ${issues.filter((i) => i.severity === 'high').length} fichaje incompleto que puedo arreglar.`)
    if (docs.some((x) => x.mandatory)) parts.push(`Tienes ${docs.filter((x) => x.mandatory).length} documento${docs.filter((x) => x.mandatory).length > 1 ? 's' : ''} obligatorio${docs.filter((x) => x.mandatory).length > 1 ? 's' : ''} por firmar.`)
    if (inbox) parts.push(`${inbox} solicitud${inbox > 1 ? 'es' : ''} de tu equipo espera${inbox > 1 ? 'n' : ''} tu respuesta.`)
    return parts.join(' ')
  }, [today.state, Math.floor(today.worked / 5), issues.length, inbox, docs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Equipo hoy
  const team = s.employees.filter((e) => e.id !== me.id)
  const k = dayKey(d)
  const teamNow = team.map((e) => {
    const sm = summarize(byDay(s.punches, e.id).get(k) ?? [], now)
    return { e, sm, off: absenceOn(e.id, k, s.requests), remote: !!sm.punches.at(-1)?.remote }
  })
  const working = teamNow.filter((t) => t.sm.state === 'working' || t.sm.state === 'break')

  // Próximos eventos
  const events = useMemo(() => {
    const ev: { d: Date; title: string; icon: React.ReactNode; tone: string }[] = []
    for (let i = 0; i < 45; i++) {
      const x = addDays(d, i)
      const kk = dayKey(x)
      if (HOLIDAYS[kk]) ev.push({ d: x, title: HOLIDAYS[kk], icon: <PartyPopper size={14} />, tone: 'text-brand bg-brand/10' })
      for (const e of s.employees) if (e.birthday && e.birthday === kk.slice(5)) ev.push({ d: x, title: `Cumpleaños de ${e.name.split(' ')[0]}`, icon: <CalendarHeart size={14} />, tone: 'text-pink-500 bg-pink-500/10' })
    }
    for (const r of s.requests) if (r.status === 'approved' && r.from >= k && r.from <= dayKey(addDays(d, 45))) {
      const e = s.employees.find((x) => x.id === r.empId)!
      ev.push({ d: parseDay(r.from), title: `${e.id === me.id ? 'Tus' : e.name.split(' ')[0] + ':'} ${TIME_OFF_TYPES.find((t) => t.id === r.typeId)!.name.toLowerCase()}`, icon: <Plane size={14} />, tone: 'text-cyan-600 bg-cyan-500/10' })
    }
    return ev.sort((a, b) => a.d.getTime() - b.d.getTime()).slice(0, 6)
  }, [s.requests, k]) // eslint-disable-line react-hooks/exhaustive-deps

  const weekBars = Array.from({ length: 5 }, (_, i) => {
    const x = addDays(startOfWeek(d, { weekStartsOn: 1 }), i)
    const sm = summarize(days.get(dayKey(x)) ?? [], now)
    return { x, w: sm.worked, p: plannedMin(me, x, s.requests), today: dayKey(x) === k }
  })
  const maxBar = Math.max(9 * 60, ...weekBars.map((b) => b.w))

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-muted">{cap(fmt(d, "EEEE, d 'de' MMMM"))}</div>
        <h1 className="text-[28px] font-semibold tracking-tight mt-0.5">
          {greet}, <span className="aurora-text">{me.name.split(' ')[0]}</span>
        </h1>
        <AiNote className="mt-4 max-w-3xl">
          <span>{brief}</span>{' '}
          <button onClick={() => useNav.getState().setCopilot(true)} className="text-brand font-medium hover:underline whitespace-nowrap">
            Pregúntame algo →
          </button>
        </AiNote>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-5">
        <div className="space-y-5 min-w-0">
          <div className="grid md:grid-cols-[300px_1fr] gap-5">
            <section className="card p-5 grid place-items-center">
              <ClockOrb size={220} compact />
            </section>
            <Section title="Tu semana" action={<button onClick={() => go('timesheet')} className="text-xs text-muted hover:text-ink flex items-center gap-1">Hoja de horas <ArrowRight size={12} /></button>}>
              <div className="flex items-end gap-3 h-[150px]">
                {weekBars.map((b, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <div className="text-[11px] tabular-nums text-muted">{b.w ? hShort(b.w) : ''}</div>
                    <div className="relative w-full max-w-[44px] flex-1 flex items-end">
                      {b.p > 0 && <div className="absolute inset-x-0 border-t-2 border-dashed border-line" style={{ bottom: `${(b.p / maxBar) * 100}%` }} />}
                      <motion.div initial={{ height: 0 }} animate={{ height: `${(b.w / maxBar) * 100}%` }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 120, damping: 18 }} className={cx('w-full rounded-lg', b.today ? 'bg-gradient-to-t from-indigo-500 to-violet-400' : b.w >= b.p && b.p ? 'bg-indigo-500/70' : 'bg-indigo-500/35')} />
                    </div>
                    <div className={cx('text-xs', b.today ? 'font-semibold text-ink' : 'text-muted')}>{cap(fmt(b.x, 'EEE'))}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-line">
                <div><div className="text-xs text-muted">Semana</div><div className="font-semibold tabular-nums">{hm(week.worked)}</div></div>
                <div><div className="text-xs text-muted">Balance</div><div className={cx('font-semibold tabular-nums', week.balance >= 0 ? 'text-ok' : 'text-warn')}>{hm(week.balance, true)}</div></div>
                <div><div className="text-xs text-muted">Mes</div><div className="font-semibold tabular-nums">{hm(month.worked)}</div></div>
              </div>
            </Section>
          </div>

          <Section title="Requiere tu atención" icon={<Sparkles size={15} />}>
            <div className="space-y-2">
              {docs.map((d) => (
                <button key={d.id} onClick={() => openSign(d.id)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-sunken text-left transition">
                  <span className={cx('h-8 w-8 rounded-lg grid place-items-center shrink-0', d.mandatory ? 'bg-bad/10 text-bad' : 'bg-brand/10 text-brand')}><FileSignature size={15} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Firmar: {d.title}</div>
                    <div className="text-xs text-muted truncate">{d.mandatory ? 'Obligatorio' : 'Opcional'}{d.due ? ` · ${dueLabel(d.due)!.t.toLowerCase()}` : ''}</div>
                  </div>
                  <ArrowRight size={14} className="text-muted" />
                </button>
              ))}
              {issues.slice(0, 3).map((i) => (
                <button key={i.day + i.kind} onClick={() => go('timesheet')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-sunken text-left transition">
                  <span className={cx('h-8 w-8 rounded-lg grid place-items-center shrink-0', i.severity === 'high' ? 'bg-bad/10 text-bad' : 'bg-warn/10 text-warn')}><TriangleAlert size={15} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{i.title} <span className="text-muted font-normal">· {cap(fmt(parseDay(i.day), 'EEE d MMM'))}</span></div>
                    <div className="text-xs text-muted truncate">{i.detail}</div>
                  </div>
                  <ArrowRight size={14} className="text-muted" />
                </button>
              ))}
              {!!inbox && (
                <button onClick={() => go('inbox')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-sunken text-left transition">
                  <span className="h-8 w-8 rounded-lg grid place-items-center bg-brand/10 text-brand"><Inbox size={15} /></span>
                  <div className="flex-1"><div className="text-sm font-medium">{inbox} aprobaciones pendientes</div><div className="text-xs text-muted">Ausencias, correcciones y hojas de horas de tu equipo</div></div>
                  <ArrowRight size={14} className="text-muted" />
                </button>
              )}
              {!issues.length && !inbox && !docs.length && <div className="text-sm text-muted py-2">Nada pendiente. Todo en orden ✨</div>}
            </div>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Equipo ahora" icon={<Users size={15} />} action={<button onClick={() => go('team')} className="text-xs text-muted hover:text-ink flex items-center gap-1">Mapa <ArrowRight size={12} /></button>}>
            <div className="flex items-baseline gap-2">
              <span className="kpi">{working.length}</span>
              <span className="text-sm text-muted">de {team.length} trabajando · {working.filter((w) => w.remote).length} en remoto</span>
            </div>
            <div className="flex -space-x-2 mt-3">
              {teamNow.map(({ e, sm, off }) => (
                <div key={e.id} title={e.name} className={cx(!(sm.state === 'working' || sm.state === 'break') && 'opacity-40 grayscale')}>
                  <Avatar emp={e} size={30} ring={off ? 'muted' : sm.state === 'working' ? 'ok' : sm.state === 'break' ? 'warn' : undefined} />
                </div>
              ))}
            </div>
          </Section>

          <div className="grid grid-cols-2 gap-5">
            <button onClick={() => go('timeoff')} className="card p-4 text-left hover:shadow-pop transition">
              <Plane size={16} className="text-brand" />
              <div className="kpi mt-2">{(TIME_OFF_TYPES[0].allowance ?? 0) - vac.used - vac.pending}</div>
              <div className="text-xs text-muted">días de vacaciones</div>
            </button>
            <button onClick={() => go('payroll')} className="card p-4 text-left hover:shadow-pop transition">
              <Wallet size={16} className="text-brand" />
              <div className="kpi mt-2 text-xl">{eur(slip.neto, 0)}</div>
              <div className="text-xs text-muted">neto estimado {fmt(d, 'MMM')}</div>
            </button>
          </div>

          <Section title="Próximamente">
            <div className="space-y-2.5">
              {events.map((e, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 text-center shrink-0">
                    <div className="text-[10px] uppercase text-muted">{fmt(e.d, 'MMM')}</div>
                    <div className="font-semibold leading-none">{fmt(e.d, 'd')}</div>
                  </div>
                  <span className={cx('h-7 w-7 rounded-lg grid place-items-center shrink-0', e.tone)}>{e.icon}</span>
                  <div className="text-sm truncate">{e.title}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
