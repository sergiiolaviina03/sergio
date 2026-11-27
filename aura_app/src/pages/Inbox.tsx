import { Inbox, Check, X, Sparkles, Clock3, Table2, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { TIME_OFF_TYPES } from '../data/seed'
import { workingDays, absenceOn, rangeStats, byDay, findIssues } from '../lib/attendance'
import { cap, dayKey, fmt, hm, parseDay } from '../lib/time'
import { Avatar, Empty, PageHeader, Tabs, cx, toast } from '../components/ui'
import { LABEL } from '../components/ClockFlow'
import { endOfMonth } from 'date-fns'

type Item = { id: string; kind: 'leave' | 'correction' | 'period'; empId: string; createdAt: number; title: string; sub: string; advice: { ok: boolean; text: string }; approve: () => void; reject?: () => void }

export function InboxPage() {
  const s = useStore()
  const [tab, setTab] = useState<'pending' | 'done'>('pending')
  const team = s.employees.filter((e) => e.managerId === s.meId)
  const ids = new Set(team.map((e) => e.id))
  const emp = (id: string) => s.employees.find((e) => e.id === id)!

  const items: Item[] = [
    ...s.requests.filter((r) => ids.has(r.empId) && r.status === 'pending').map((r): Item => {
      const t = TIME_OFF_TYPES.find((x) => x.id === r.typeId)!
      const e = emp(r.empId)
      const wd = workingDays(parseDay(r.from), parseDay(r.to))
      const mates = s.employees.filter((x) => x.team === e.team && x.id !== e.id)
      const clash = mates.filter((m) => wd.some((d) => absenceOn(m.id, dayKey(d), s.requests)) || s.requests.some((o) => o.id !== r.id && o.empId === m.id && o.status === 'pending' && o.from <= r.to && o.to >= r.from))
      const coverage = Math.round(((mates.length - clash.length) / Math.max(1, mates.length)) * 100)
      const ok = coverage >= 60
      return {
        id: r.id, kind: 'leave', empId: r.empId, createdAt: r.createdAt,
        title: `${t.emoji} ${t.name} · ${r.hours ? `${r.hours} h` : `${wd.length} día${wd.length !== 1 ? 's' : ''}`}`,
        sub: `${r.from === r.to ? cap(fmt(parseDay(r.from), "EEEE d 'de' MMMM")) : `${fmt(parseDay(r.from), 'd MMM')} → ${fmt(parseDay(r.to), 'd MMM yyyy')}`}${r.note ? ` · «${r.note}»` : ''}`,
        advice: { ok, text: ok ? `Cobertura del equipo ${coverage}%${clash.length ? ` (${clash.map((c) => c.name.split(' ')[0]).join(', ')} también fuera)` : ', sin solapamientos'}. Recomiendo aprobar.` : `Cobertura baja (${coverage}%): ${clash.map((c) => c.name.split(' ')[0]).join(', ')} también estarán fuera. Valora proponer otras fechas.` },
        approve: () => s.decideRequest(r.id, true), reject: () => s.decideRequest(r.id, false),
      }
    }),
    ...s.corrections.filter((c) => ids.has(c.empId) && c.status === 'pending').map((c): Item => {
      const e = emp(c.empId)
      const day = byDay(s.punches, e.id).get(dayKey(c.ts)) ?? []
      const hasIn = day.some((p) => p.type === 'in')
      const dup = day.some((p) => p.type === c.type)
      return {
        id: c.id, kind: 'correction', empId: c.empId, createdAt: c.createdAt,
        title: `Corrección · ${LABEL[c.type]} a las ${fmt(c.ts, 'HH:mm')}`,
        sub: `${cap(fmt(c.ts, "EEEE d 'de' MMMM"))} · «${c.reason}»`,
        advice: { ok: hasIn && !dup, text: dup ? `Ya existe un fichaje de ${LABEL[c.type].toLowerCase()} ese día: aprobarlo lo duplicaría.` : hasIn ? `Ese día hay entrada a las ${fmt(day.find((p) => p.type === 'in')!.ts, 'HH:mm')} y falta la salida; la hora propuesta encaja con su horario (${e.end}).` : 'No hay entrada ese día: revisa antes de aprobar.' },
        approve: () => s.decideCorrection(c.id, true), reject: () => s.decideCorrection(c.id, false),
      }
    }),
    ...s.periods.filter((p) => ids.has(p.empId) && p.status === 'submitted').map((p): Item => {
      const e = emp(p.empId)
      const m = parseDay(p.month + '-01')
      const days = byDay(s.punches, e.id)
      const st = rangeStats(e, days, s.requests, m, endOfMonth(m))
      const iss = findIssues(e, days).filter((i) => i.day.startsWith(p.month))
      return {
        id: p.empId + p.month, kind: 'period', empId: p.empId, createdAt: Date.now() - 864e5,
        title: `Hoja de horas · ${cap(fmt(m, 'MMMM yyyy'))}`,
        sub: `${hm(st.worked)} trabajadas de ${hm(st.planned)} · balance ${hm(st.balance, true)}`,
        advice: { ok: !iss.length, text: iss.length ? `${iss.length} incidencia${iss.length > 1 ? 's' : ''} sin resolver (${[...new Set(iss.map((i) => i.title.toLowerCase()))].join(', ')}).` : 'Sin incidencias. Todo cuadra con su planificación.' },
        approve: () => s.decidePeriod(p.empId, p.month),
      }
    }),
  ].sort((a, b) => b.createdAt - a.createdAt)

  const done = [
    ...s.requests.filter((r) => ids.has(r.empId) && r.status !== 'pending' && r.decidedBy === s.meId),
  ].slice(-10).reverse()

  const recommended = items.filter((i) => i.advice.ok)
  const icon = (k: Item['kind']) => (k === 'leave' ? <Sparkles size={14} /> : k === 'correction' ? <Clock3 size={14} /> : <Table2 size={14} />)

  return (
    <div>
      <PageHeader
        icon={<Inbox size={19} />}
        title="Bandeja"
        subtitle="Aprobaciones de tu equipo, con recomendación automática"
        actions={recommended.length > 1 && tab === 'pending' ? <button className="btn-brand" onClick={() => { recommended.forEach((i) => i.approve()); toast({ title: `${recommended.length} solicitudes aprobadas`, body: 'Solo las que el copiloto marcó como seguras.', tone: 'ai' }) }}><CheckCheck size={15} /> Aprobar recomendadas ({recommended.length})</button> : undefined}
        tabs={<Tabs value={tab} onChange={setTab} items={[{ id: 'pending', label: <>Pendientes {!!items.length && <span className="chip bg-brand text-white ml-1">{items.length}</span>}</> }, { id: 'done', label: 'Resueltas' }]} />}
      />
      {tab === 'pending' ? (
        items.length ? (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {items.map((it) => {
                const e = emp(it.empId)
                return (
                  <motion.div key={it.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }} className="card p-4 flex flex-wrap gap-4 items-start">
                    <Avatar emp={e} size={40} />
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 text-xs text-muted"><span className="font-medium text-ink">{e.name}</span> · {e.role} · {fmt(it.createdAt, "d MMM HH:mm")}</div>
                      <div className="text-[15px] font-medium mt-1 flex items-center gap-2"><span className="text-muted">{icon(it.kind)}</span>{it.title}</div>
                      <div className="text-sm text-muted">{it.sub}</div>
                      <div className={cx('mt-2.5 text-xs rounded-lg px-2.5 py-1.5 inline-flex gap-1.5 items-start', it.advice.ok ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn')}>
                        <Sparkles size={12} className="mt-0.5 shrink-0" /> <span>{it.advice.text}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 self-center">
                      {it.reject && <button className="btn-outline" onClick={() => { it.reject!(); toast({ title: 'Solicitud rechazada', tone: 'warn' }) }}><X size={15} /> Rechazar</button>}
                      <button className="btn-primary" onClick={() => { it.approve(); toast({ title: 'Aprobado', body: `${e.name.split(' ')[0]} recibirá una notificación.` }) }}><Check size={15} /> Aprobar</button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="card"><Empty icon={<CheckCheck size={20} />} title="Bandeja a cero" body="No hay nada pendiente. Tu equipo está al día." /></div>
        )
      ) : (
        <div className="card divide-y divide-line">
          {done.length ? done.map((r) => {
            const e = emp(r.empId)
            const t = TIME_OFF_TYPES.find((x) => x.id === r.typeId)!
            return (
              <div key={r.id} className="flex items-center gap-3 p-4">
                <Avatar emp={e} size={32} />
                <div className="flex-1 text-sm"><b className="font-medium">{e.name}</b> · {t.emoji} {t.name} · {fmt(parseDay(r.from), 'd MMM')}</div>
                <span className={cx('chip', r.status === 'approved' ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad')}>{r.status === 'approved' ? 'Aprobada' : 'Rechazada'}</span>
              </div>
            )
          }) : <Empty icon={<Inbox size={20} />} title="Aún no has resuelto solicitudes" />}
        </div>
      )}
    </div>
  )
}
