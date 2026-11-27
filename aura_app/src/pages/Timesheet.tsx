import { Table2, ChevronLeft, ChevronRight, Download, FileDown, Send, ChevronDown, Wand2, CheckCircle2, Clock3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { addMonths, endOfMonth, startOfMonth, subMonths } from 'date-fns'
import { useStore } from '../store'
import { byDay, findIssues, plannedMin, rangeStats, summarize, absenceOn } from '../lib/attendance'
import { cap, dayKey, fmt, hm, monthDays, monthKey, isoDow } from '../lib/time'
import { HOLIDAYS, TIME_OFF_TYPES } from '../data/seed'
import { AiNote, Avatar, PageHeader, Section, Stat, cx, toast } from '../components/ui'
import { DayBar } from '../components/ClockOrb'
import { LABEL } from '../components/ClockFlow'
import { useNow } from '../lib/hooks'
import { saveFile } from '../lib/platform'
import { timesheetPdf } from '../lib/pdf'

export function TimesheetPage() {
  const s = useStore()
  const now = useNow(30000)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [empId, setEmpId] = useState(s.meId)
  const [open, setOpen] = useState<string>()
  const emp = s.employees.find((e) => e.id === empId)!
  const days = useMemo(() => byDay(s.punches, empId), [s.punches, empId])
  const mk = monthKey(month)
  const stats = rangeStats(emp, days, s.requests, month, endOfMonth(month), now)
  const bank = rangeStats(emp, days, s.requests, startOfMonth(subMonths(new Date(), 2)), new Date(), now)
  const issues = useMemo(() => findIssues(emp, days, new Date()).filter((i) => i.day.startsWith(mk)), [days, mk]) // eslint-disable-line react-hooks/exhaustive-deps
  const period = s.periods.find((p) => p.empId === empId && p.month === mk)
  const isMe = empId === s.meId
  const manager = s.settings.viewAs === 'manager'
  const pendingCorr = s.corrections.filter((c) => c.empId === empId && c.status === 'pending')

  const rows = monthDays(month).map((d) => {
    const k = dayKey(d)
    const sm = summarize(days.get(k) ?? [], now)
    const p = plannedMin(emp, d, s.requests)
    return { d, k, sm, p, hol: HOLIDAYS[k], off: absenceOn(emp.id, k, s.requests), future: d.getTime() > now, issue: issues.filter((i) => i.day === k) }
  })

  const exportPdf = async () => {
    const blob = timesheetPdf(emp, cap(fmt(month, 'MMMM yyyy')), rows.filter((r) => !r.future && (r.p || r.sm.punches.length)).map((r) => ({ k: r.k, punches: r.sm.punches, planned: r.p })), (id) => (id ? s.zones.find((z) => z.id === id)?.name.split(' · ')[0] ?? '' : id === null ? 'Remoto/fuera' : '—'))
    const ok = await saveFile(`registro-jornada-${emp.name.replace(/\s/g, '_')}-${mk}.pdf`, blob)
    toast(ok ? { title: 'Registro de jornada en PDF descargado' } : { title: 'No se pudo descargar', tone: 'warn' })
  }
  const exportCsv = async () => {
    const head = ['Fecha', 'Empleado', 'Tipo', 'Hora', 'Centro', 'Lat', 'Lng', 'Precisión (m)', 'Método', 'Incidencias', 'Seq', 'Sello SHA-256']
    const lines = rows.flatMap((r) => r.sm.punches.map((p) => [r.k, emp.name, LABEL[p.type], fmt(p.ts, 'HH:mm:ss'), p.zoneId ? s.zones.find((z) => z.id === p.zoneId)?.name : p.remote ? 'Teletrabajo' : 'Fuera de zona', p.lat ?? '', p.lng ?? '', p.acc ?? '', p.method, p.flags.join(' '), p.seq, p.hash]))
    const csv = [head, ...lines].map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n')
    await saveFile(`registro-jornada-${emp.name.replace(/\s/g, '_')}-${mk}.csv`, '\ufeff' + csv, 'text/csv')
    toast({ title: 'Registro exportado', body: 'CSV con sellos verificables, listo para la Inspección de Trabajo.' })
  }

  const fixIssue = (ts: number) => {
    s.requestCorrection({ type: 'out', ts, reason: 'Olvido de fichaje · propuesto por el copiloto' })
    toast({ title: 'Corrección enviada', body: `Salida a las ${fmt(ts, 'HH:mm')} pendiente de aprobación.`, tone: 'ai' })
  }

  const statusChip = period?.status === 'approved' ? <span className="chip bg-ok/10 text-ok"><CheckCircle2 size={11} /> Aprobado</span> : period?.status === 'submitted' ? <span className="chip bg-brand/10 text-brand"><Clock3 size={11} /> Enviado a revisión</span> : <span className="chip bg-sunken text-muted">En curso</span>

  return (
    <div>
      <PageHeader
        icon={<Table2 size={19} />}
        title="Hoja de horas"
        subtitle={<span className="inline-flex items-center gap-2">{cap(fmt(month, 'MMMM yyyy'))} {statusChip}</span>}
        actions={
          <>
            {manager && (
              <select className="input h-9 w-auto pr-8" value={empId} onChange={(e) => setEmpId(e.target.value)}>
                {s.employees.map((e) => <option key={e.id} value={e.id}>{e.id === s.meId ? `${e.name} (tú)` : e.name}</option>)}
              </select>
            )}
            <div className="flex">
              <button className="btn-outline rounded-r-none px-2.5" onClick={() => setMonth(subMonths(month, 1))} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
              <button className="btn-outline rounded-none border-x-0" onClick={() => setMonth(startOfMonth(new Date()))}>Hoy</button>
              <button className="btn-outline rounded-l-none px-2.5" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
            </div>
            <button className="btn-outline" onClick={exportPdf}><FileDown size={15} /> PDF</button>
            <button className="btn-outline" onClick={exportCsv}><Download size={15} /> CSV</button>
            {isMe && period?.status === 'open' && <button className="btn-primary" onClick={() => { s.submitPeriod(mk); toast({ title: 'Hoja enviada a tu responsable' }) }}><Send size={15} /> Enviar</button>}
            {!isMe && manager && period?.status === 'submitted' && <button className="btn-brand" onClick={() => { s.decidePeriod(empId, mk); toast({ title: 'Hoja aprobada' }) }}><CheckCircle2 size={15} /> Aprobar</button>}
          </>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        {[
          <Stat key="w" label="Trabajadas" value={hm(stats.worked)} />,
          <Stat key="p" label="Planificadas" value={hm(stats.planned)} />,
          <Stat key="b" label="Balance del mes" value={hm(stats.balance, true)} tone={stats.balance >= 0 ? 'ok' : 'warn'} />,
          <Stat key="o" label="Por encima de jornada" value={hm(stats.overtime)} sub="computable como horas extra" />,
          <Stat key="k" label="Banco de horas" value={hm(bank.balance, true)} sub="últimos 3 meses" tone="brand" />,
        ].map((x, i) => <div key={i} className="card p-4">{x}</div>)}
      </div>

      {!!issues.length && (
        <AiNote className="mb-5">
          <div className="font-medium mb-1.5">He detectado {issues.length} incidencia{issues.length > 1 ? 's' : ''} este mes</div>
          <div className="space-y-1.5">
            {issues.map((i) => (
              <div key={i.day + i.kind} className="flex flex-wrap items-center gap-2 text-sm">
                <span className={cx('h-1.5 w-1.5 rounded-full', i.severity === 'high' ? 'bg-bad' : 'bg-warn')} />
                <b className="font-medium">{cap(fmt(new Date(i.day + 'T12:00'), 'EEE d'))}</b>
                <span className="text-muted">{i.title}. {i.detail}</span>
                {i.suggestTs && isMe && !pendingCorr.some((c) => dayKey(c.ts) === i.day) && (
                  <button onClick={() => fixIssue(i.suggestTs!)} className="chip bg-brand text-white hover:brightness-110"><Wand2 size={11} /> Proponer salida {fmt(i.suggestTs, 'HH:mm')}</button>
                )}
                {pendingCorr.some((c) => dayKey(c.ts) === i.day) && <span className="chip bg-brand/10 text-brand">Corrección pendiente</span>}
              </div>
            ))}
          </div>
        </AiNote>
      )}

      <div className="grid xl:grid-cols-[1fr_300px] gap-5">
        <section className="card overflow-hidden">
          <div className="grid grid-cols-[110px_1fr_90px_90px_90px] max-md:grid-cols-[90px_1fr_80px] text-xs text-muted font-medium px-4 h-10 items-center border-b border-line bg-sunken/50">
            <span>Día</span><span>Jornada</span><span className="text-right">Trabajado</span><span className="text-right max-md:hidden">Previsto</span><span className="text-right max-md:hidden">Balance</span>
          </div>
          {rows.map((r) => {
            const weekend = isoDow(r.d) > 5
            const bal = r.sm.worked - r.p
            const t = r.off && TIME_OFF_TYPES.find((x) => x.id === r.off!.typeId)
            return (
              <div key={r.k} className={cx('border-b border-line last:border-0', weekend && 'bg-sunken/40')}>
                <button onClick={() => r.sm.punches.length && setOpen(open === r.k ? undefined : r.k)} className="w-full grid grid-cols-[110px_1fr_90px_90px_90px] max-md:grid-cols-[90px_1fr_80px] items-center px-4 h-12 text-sm text-left hover:bg-sunken/60 transition">
                  <span className={cx('flex items-center gap-1.5', r.k === dayKey(now) && 'font-semibold text-brand')}>
                    {r.sm.punches.length ? <ChevronDown size={13} className={cx('text-muted transition', open === r.k && 'rotate-180')} /> : <span className="w-[13px]" />}
                    {cap(fmt(r.d, 'EEE d'))}
                    {!!r.issue.length && <span className="h-1.5 w-1.5 rounded-full bg-warn" />}
                  </span>
                  <span className="pr-4 min-w-0">
                    {r.sm.segs.length ? <DayBar segs={r.sm.segs} /> : r.hol ? <span className="chip bg-brand/10 text-brand">🎉 {r.hol}</span> : t ? <span className="chip" style={{ background: t.color + '1a', color: t.color }}>{t.emoji} {t.name}{r.off?.hours ? ` · ${r.off.hours} h` : ''}</span> : weekend ? <span className="text-xs text-muted">Fin de semana</span> : r.future ? <span className="text-xs text-muted">—</span> : <span className="chip bg-bad/10 text-bad">Sin fichajes</span>}
                  </span>
                  <span className="text-right tabular-nums">{r.sm.worked ? hm(r.sm.worked) : '—'}</span>
                  <span className="text-right tabular-nums text-muted max-md:hidden">{r.p ? hm(r.p) : '—'}</span>
                  <span className={cx('text-right tabular-nums max-md:hidden', r.future || (!r.p && !r.sm.worked) ? 'text-muted' : bal >= 0 ? 'text-ok' : 'text-warn')}>{r.future || (!r.p && !r.sm.worked) ? '—' : hm(bal, true)}</span>
                </button>
                <AnimatePresence>
                  {open === r.k && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-3 pl-10 flex flex-wrap gap-2">
                        {r.sm.punches.map((p) => (
                          <span key={p.id} className="chip bg-sunken border border-line text-ink h-7 px-2.5 text-xs">
                            <span className={cx('h-1.5 w-1.5 rounded-full', p.type === 'in' ? 'bg-indigo-500' : p.type === 'out' ? 'bg-emerald-500' : 'bg-amber-500')} />
                            {LABEL[p.type]} {fmt(p.ts, 'HH:mm')}
                            <span className="text-muted">· {p.zoneId ? s.zones.find((z) => z.id === p.zoneId)?.name.split(' · ')[0] : p.remote ? 'remoto' : p.lat != null ? 'fuera' : '—'}</span>
                            {p.method === 'correction' && <span className="text-brand">· corrección</span>}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </section>

        <div className="space-y-5">
          <Section title="Mapa de calor">
            <Heat rows={rows} />
          </Section>
          <Section title="Empleado">
            <div className="flex items-center gap-3">
              <Avatar emp={emp} size={40} />
              <div>
                <div className="text-sm font-medium">{emp.name}</div>
                <div className="text-xs text-muted">{emp.role} · {emp.team}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div><div className="text-xs text-muted">Horario</div>{emp.start}–{emp.end}</div>
              <div><div className="text-xs text-muted">Jornada</div>{emp.weeklyHours} h/sem</div>
              <div><div className="text-xs text-muted">Pausa</div>{emp.breakMin} min</div>
              <div><div className="text-xs text-muted">Teletrabajo</div>{emp.remoteDays.length ? emp.remoteDays.map((d) => ['L', 'M', 'X', 'J', 'V'][d - 1]).join(' ') : '—'}</div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Heat({ rows }: { rows: { d: Date; sm: { worked: number }; p: number; future: boolean }[] }) {
  const pad = isoDow(rows[0].d) - 1
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-[10px] text-muted text-center mb-1.5">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => <span key={x}>{x}</span>)}</div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: pad }, (_, i) => <span key={'p' + i} />)}
        {rows.map((r) => {
          const ratio = r.p ? r.sm.worked / r.p : r.sm.worked ? 1.2 : 0
          const bg = r.future ? 'rgb(var(--sunken))' : !r.sm.worked ? (r.p ? 'rgb(239 68 68 / .15)' : 'rgb(var(--sunken))') : `rgb(99 102 241 / ${Math.min(1, 0.25 + ratio * 0.6)})`
          return <div key={r.d.getTime()} title={`${fmt(r.d, 'd MMM')} · ${hm(r.sm.worked)}`} className="aspect-square rounded-md grid place-items-center text-[10px]" style={{ background: bg, color: ratio > 0.7 ? 'white' : undefined }}>{r.d.getDate()}</div>
        })}
      </div>
    </div>
  )
}
