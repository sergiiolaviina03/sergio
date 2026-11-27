import { CalendarRange, ChevronLeft, ChevronRight, Copy, Wand2, Send, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { addDays, startOfWeek } from 'date-fns'
import { useStore } from '../store'
import type { Employee, Shift } from '../types'
import { AiNote, Avatar, Modal, PageHeader, cx, toast } from '../components/ui'
import { cap, dayKey, fmt, hm, hShort, isoDow, toMin } from '../lib/time'
import { absenceOn, shiftMinutes } from '../lib/attendance'
import { HOLIDAYS, TIME_OFF_TYPES } from '../data/seed'
import { uid } from '../lib/rng'

const PRESETS = [
  { label: 'Mañana', start: '07:00', end: '15:00', breakMin: 20 },
  { label: 'Tarde', start: '15:00', end: '23:00', breakMin: 20 },
  { label: 'Oficina', start: '09:00', end: '18:00', breakMin: 60 },
  { label: 'Partido', start: '10:00', end: '14:00', breakMin: 0 },
  { label: 'Noche', start: '23:00', end: '07:00', breakMin: 30 },
]

type Warn = { empId: string; date?: string; text: string }

function analyse(emps: Employee[], shifts: Shift[], days: string[], reqs: ReturnType<typeof useStore.getState>['requests']): Warn[] {
  const w: Warn[] = []
  for (const e of emps) {
    const mine = shifts.filter((x) => x.empId === e.id && days.includes(x.date)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    const total = mine.reduce((a, x) => a + shiftMinutes(x), 0)
    if (mine.length && total > e.weeklyHours * 60 + 30) w.push({ empId: e.id, text: `${e.name.split(' ')[0]}: ${hm(total)} planificadas, por encima de su jornada de ${e.weeklyHours} h` })
    for (let i = 1; i < mine.length; i++) {
      const prevEnd = new Date(mine[i - 1].date + 'T' + mine[i - 1].end).getTime() + (toMin(mine[i - 1].end) <= toMin(mine[i - 1].start) ? 864e5 : 0)
      const nextStart = new Date(mine[i].date + 'T' + mine[i].start).getTime()
      if (nextStart - prevEnd < 12 * 3600e3 && nextStart > prevEnd - 1) w.push({ empId: e.id, date: mine[i].date, text: `${e.name.split(' ')[0]}: menos de 12 h de descanso antes del turno del ${fmt(new Date(mine[i].date), 'EEE d')} (art. 34.3 ET)` })
    }
    const worked = new Set(mine.map((x) => x.date))
    if (worked.size >= 7) w.push({ empId: e.id, text: `${e.name.split(' ')[0]}: sin día y medio de descanso semanal (art. 37.1 ET)` })
    for (const x of mine) {
      const off = absenceOn(e.id, x.date, reqs)
      if (off && !off.hours) w.push({ empId: e.id, date: x.date, text: `${e.name.split(' ')[0]} tiene ${TIME_OFF_TYPES.find((t) => t.id === off.typeId)?.name.toLowerCase()} el ${fmt(new Date(x.date), 'EEE d')}` })
    }
  }
  return w
}

export function ShiftsPage() {
  const s = useStore()
  const [week, setWeek] = useState(() => startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }))
  const [edit, setEdit] = useState<Shift | null>(null)
  const [drag, setDrag] = useState<string>()
  const [team, setTeam] = useState('all')
  const days = Array.from({ length: 7 }, (_, i) => dayKey(addDays(week, i)))
  const teams = [...new Set(s.employees.map((e) => e.team))]
  const emps = s.employees.filter((e) => team === 'all' || e.team === team)
  const inWeek = s.shifts.filter((x) => days.includes(x.date))
  const warns = useMemo(() => analyse(emps, s.shifts, days, s.requests), [s.shifts, emps, days.join(), s.requests]) // eslint-disable-line react-hooks/exhaustive-deps
  const unpublished = inWeek.filter((x) => !x.published && emps.some((e) => e.id === x.empId)).length
  const zoneColor = (id: string) => s.zones.find((z) => z.id === id)?.color ?? '#6366f1'

  const autofill = () => {
    const add: Shift[] = []
    for (const e of emps)
      for (const d of days) {
        const dt = new Date(d + 'T12:00')
        if (isoDow(dt) > 5 || HOLIDAYS[d] || absenceOn(e.id, d, s.requests) || inWeek.some((x) => x.empId === e.id && x.date === d)) continue
        add.push({ id: uid('s_'), empId: e.id, date: d, start: e.start, end: e.end, breakMin: e.breakMin, zoneId: e.zoneId, published: false, label: e.remoteDays.includes(isoDow(dt)) ? 'Remoto' : undefined })
      }
    s.setShifts((x) => [...x, ...add])
    toast({ title: `${add.length} turnos creados`, body: 'A partir del horario de cada persona, respetando festivos y ausencias.', tone: 'ai' })
  }
  const copyPrev = () => {
    const prevDays = days.map((d) => dayKey(addDays(new Date(d + 'T12:00'), -7)))
    const src = s.shifts.filter((x) => prevDays.includes(x.date) && emps.some((e) => e.id === x.empId))
    if (!src.length) return toast({ title: 'La semana anterior está vacía', tone: 'warn' })
    s.setShifts((x) => [...x.filter((y) => !(days.includes(y.date) && emps.some((e) => e.id === y.empId))), ...src.map((y) => ({ ...y, id: uid('s_'), date: dayKey(addDays(new Date(y.date + 'T12:00'), 7)), published: false }))])
    toast({ title: `${src.length} turnos copiados de la semana anterior` })
  }
  const publish = () => {
    s.setShifts((x) => x.map((y) => (days.includes(y.date) && emps.some((e) => e.id === y.empId) ? { ...y, published: true } : y)))
    s.notify({ title: `Cuadrante publicado: semana del ${fmt(week, "d 'de' MMMM")}` })
    toast({ title: 'Cuadrante publicado', body: `${new Set(inWeek.map((x) => x.empId)).size} personas reciben su horario.`, tone: 'ai' })
  }
  const drop = (empId: string, date: string) => {
    if (!drag) return
    s.setShifts((x) => x.map((y) => (y.id === drag ? { ...y, empId, date, published: false } : y)))
    setDrag(undefined)
  }

  // Cobertura por franjas de 2 h
  const bands = Array.from({ length: 9 }, (_, i) => 6 + i * 2)
  const coverage = days.map((d) => bands.map((h) => inWeek.filter((x) => x.date === d && emps.some((e) => e.id === x.empId)).filter((x) => { const a = toMin(x.start); let b = toMin(x.end); if (b <= a) b += 1440; return a <= h * 60 && b > h * 60 }).length))
  const maxCov = Math.max(1, ...coverage.flat())

  return (
    <div>
      <PageHeader
        icon={<CalendarRange size={19} />}
        title="Turnos"
        subtitle={<span className="inline-flex items-center gap-2">Semana del {fmt(week, "d 'de' MMMM")} {unpublished ? <span className="chip bg-warn/10 text-warn">{unpublished} sin publicar</span> : inWeek.length ? <span className="chip bg-ok/10 text-ok">Publicado</span> : null}</span>}
        actions={
          <>
            <select className="input h-9 w-auto" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Equipo"><option value="all">Todos los equipos</option>{teams.map((t) => <option key={t}>{t}</option>)}</select>
            <div className="flex">
              <button className="btn-outline rounded-r-none px-2.5" onClick={() => setWeek(addDays(week, -7))} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
              <button className="btn-outline rounded-none border-x-0" onClick={() => setWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Hoy</button>
              <button className="btn-outline rounded-l-none px-2.5" onClick={() => setWeek(addDays(week, 7))} aria-label="Semana siguiente"><ChevronRight size={16} /></button>
            </div>
            <button className="btn-outline" onClick={copyPrev}><Copy size={15} /> Copiar anterior</button>
            <button className="btn-outline" onClick={autofill}><Wand2 size={15} /> Autocompletar</button>
            <button className="btn-brand" disabled={!unpublished} onClick={publish}><Send size={15} /> Publicar</button>
          </>
        }
      />
      {!!warns.length && (
        <AiNote className="mb-4">
          <div className="font-medium mb-1">Revisa antes de publicar</div>
          <ul className="text-sm text-muted space-y-0.5">{warns.slice(0, 6).map((w, i) => <li key={i} className="flex gap-1.5"><AlertTriangle size={13} className="text-warn mt-0.5 shrink-0" />{w.text}</li>)}</ul>
        </AiNote>
      )}
      <section className="card overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[220px_repeat(7,1fr)_100px] text-xs text-muted font-medium border-b border-line bg-sunken/50">
            <div className="px-4 h-11 flex items-center">Persona</div>
            {days.map((d) => {
              const dt = new Date(d + 'T12:00')
              return <div key={d} className={cx('h-11 flex flex-col justify-center px-2', d === dayKey(new Date()) && 'text-brand', isoDow(dt) > 5 && 'bg-sunken/60')}><span>{cap(fmt(dt, 'EEE d'))}</span>{HOLIDAYS[d] && <span className="text-[10px] text-brand truncate">🎉 {HOLIDAYS[d]}</span>}</div>
            })}
            <div className="h-11 flex items-center justify-end px-4">Horas</div>
          </div>
          {emps.map((e) => {
            const tot = inWeek.filter((x) => x.empId === e.id).reduce((a, x) => a + shiftMinutes(x), 0)
            return (
              <div key={e.id} className="grid grid-cols-[220px_repeat(7,1fr)_100px] border-b border-line last:border-0">
                <div className="px-4 py-2 flex items-center gap-2.5"><Avatar emp={e} size={28} /><div className="min-w-0"><div className="text-sm font-medium truncate">{e.name}</div><div className="text-[11px] text-muted truncate">{e.role}</div></div></div>
                {days.map((d) => {
                  const cell = inWeek.filter((x) => x.empId === e.id && x.date === d)
                  const off = absenceOn(e.id, d, s.requests)
                  const t = off && TIME_OFF_TYPES.find((x) => x.id === off.typeId)
                  const warn = warns.some((w) => w.empId === e.id && w.date === d)
                  return (
                    <div key={d} onDragOver={(ev) => ev.preventDefault()} onDrop={() => drop(e.id, d)} className={cx('p-1.5 min-h-[58px] border-l border-line group relative', isoDow(new Date(d + 'T12:00')) > 5 && 'bg-sunken/40', warn && 'bg-warn/5')}>
                      {t && !off!.hours && <div className="text-[10px] rounded-md px-1.5 py-1 mb-1" style={{ background: t.color + '1a', color: t.color }}>{t.emoji} {t.name}</div>}
                      {cell.map((x) => (
                        <button key={x.id} draggable onDragStart={() => setDrag(x.id)} onClick={() => setEdit(x)} className={cx('w-full text-left rounded-lg px-2 py-1 mb-1 text-[11px] leading-tight border cursor-grab active:cursor-grabbing transition hover:shadow-card', x.published ? 'border-transparent text-white' : 'border-dashed bg-surface')} style={x.published ? { background: zoneColor(x.zoneId) } : { borderColor: zoneColor(x.zoneId), color: zoneColor(x.zoneId) }}>
                          <div className="font-semibold tabular-nums">{x.start}–{x.end}</div>
                          <div className="opacity-80 truncate">{x.label ?? s.zones.find((z) => z.id === x.zoneId)?.name.split(' · ')[0]}</div>
                        </button>
                      ))}
                      <button onClick={() => setEdit({ id: uid('s_'), empId: e.id, date: d, start: e.start, end: e.end, breakMin: e.breakMin, zoneId: e.zoneId, published: false })} className="absolute bottom-1 right-1 h-6 w-6 rounded-md grid place-items-center text-muted opacity-0 group-hover:opacity-100 hover:bg-sunken transition" aria-label="Añadir turno"><Plus size={13} /></button>
                    </div>
                  )
                })}
                <div className={cx('px-4 flex items-center justify-end text-sm tabular-nums whitespace-nowrap', tot > e.weeklyHours * 60 + 30 ? 'text-bad font-semibold' : tot ? '' : 'text-muted')}>{tot ? hShort(tot) : '—'}<span className="text-[10px] text-muted ml-1">/{e.weeklyHours}</span></div>
              </div>
            )
          })}
          <div className="grid grid-cols-[220px_repeat(7,1fr)_100px] bg-sunken/40">
            <div className="px-4 py-3 text-xs text-muted">Cobertura<br /><span className="text-[10px]">06:00 → 22:00</span></div>
            {coverage.map((c, i) => (
              <div key={i} className="px-2 py-3 border-l border-line flex items-end gap-[2px] h-[58px]">
                {c.map((n, j) => <div key={j} title={`${bands[j]}:00 · ${n} personas`} className="flex-1 rounded-sm" style={{ height: `${Math.max(6, (n / maxCov) * 100)}%`, background: n ? `rgb(99 102 241 / ${0.25 + (n / maxCov) * 0.75})` : 'rgb(var(--line))' }} />)}
              </div>
            ))}
            <div />
          </div>
        </div>
      </section>
      <p className="text-xs text-muted mt-3">Arrastra un turno para moverlo · pulsa una celda vacía para añadir · los turnos con borde discontinuo aún no se han publicado. Al publicarlos, pasan a ser la jornada prevista en la hoja de horas.</p>
      <ShiftModal shift={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function ShiftModal({ shift, onClose }: { shift: Shift | null; onClose: () => void }) {
  const s = useStore()
  const [f, setF] = useState(shift)
  const [last, setLast] = useState(shift)
  if (shift !== last) {
    setLast(shift)
    setF(shift)
  }
  if (!f) return <Modal open={false} onClose={onClose}>{null}</Modal>
  const exists = s.shifts.some((x) => x.id === f.id)
  const emp = s.employees.find((e) => e.id === f.empId)!
  const save = () => {
    s.setShifts((x) => (exists ? x.map((y) => (y.id === f.id ? { ...f, published: false } : y)) : [...x, f]))
    onClose()
  }
  return (
    <Modal open={!!shift} onClose={onClose} title={`${exists ? 'Editar' : 'Nuevo'} turno · ${emp.name.split(' ')[0]}`} icon={<Avatar emp={emp} size={28} />}>
      <div className="text-sm text-muted mb-3">{cap(fmt(new Date(f.date + 'T12:00'), "EEEE d 'de' MMMM"))}</div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {PRESETS.map((p) => <button key={p.label} onClick={() => setF({ ...f, start: p.start, end: p.end, breakMin: p.breakMin, label: p.label === 'Oficina' ? undefined : p.label })} className={cx('chip h-8 px-3 border text-xs', f.start === p.start && f.end === p.end ? 'bg-brand text-white border-transparent' : 'border-line bg-surface text-ink hover:bg-sunken')}>{p.label} · {p.start}–{p.end}</button>)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label" htmlFor="sh-s">Entrada</label><input id="sh-s" type="time" className="input" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div>
        <div><label className="label" htmlFor="sh-e">Salida</label><input id="sh-e" type="time" className="input" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div>
        <div><label className="label" htmlFor="sh-b">Pausa (min)</label><input id="sh-b" type="number" className="input" value={f.breakMin} onChange={(e) => setF({ ...f, breakMin: +e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div><label className="label" htmlFor="sh-z">Centro</label><select id="sh-z" className="input" value={f.zoneId} onChange={(e) => setF({ ...f, zoneId: e.target.value })}>{s.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
        <div><label className="label" htmlFor="sh-l">Etiqueta</label><input id="sh-l" className="input" value={f.label ?? ''} placeholder="Caja, almacén, remoto…" onChange={(e) => setF({ ...f, label: e.target.value || undefined })} /></div>
      </div>
      <div className="text-sm mt-3">Duración efectiva: <b>{hm(shiftMinutes(f))}</b></div>
      <div className="flex items-center gap-2 mt-5">
        {exists && <button className="btn-ghost text-bad" onClick={() => { s.setShifts((x) => x.filter((y) => y.id !== f.id)); onClose() }}><Trash2 size={14} /> Eliminar</button>}
        <button className="btn-ghost ml-auto" onClick={onClose}>Cancelar</button>
        <button className="btn-brand" onClick={save}>Guardar</button>
      </div>
    </Modal>
  )
}
