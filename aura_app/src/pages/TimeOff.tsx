import { CalendarDays, Plus, Sparkles, ChevronLeft, ChevronRight, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMe, useStore } from '../store'
import { HOLIDAYS, TIME_OFF_TYPES } from '../data/seed'
import { timeOffUsage, workingDays, absenceOn } from '../lib/attendance'
import { cap, dayKey, fmt, isoDow, monthDays, parseDay } from '../lib/time'
import { AiNote, Avatar, Modal, PageHeader, Section, cx, toast } from '../components/ui'
import { parse, parseDates } from '../lib/copilot'
import type { TimeOffRequest } from '../types'

export function TimeOffPage() {
  const me = useMe()
  const s = useStore()
  const [year, setYear] = useState(new Date().getFullYear())
  const [modal, setModal] = useState<{ typeId: string; from: string; to: string; hours?: number; note?: string } | null>(null)
  const [nl, setNl] = useState('')
  const usage = timeOffUsage(me.id, s.requests, year)
  const mine = s.requests.filter((r) => r.empId === me.id).sort((a, b) => b.from.localeCompare(a.from))

  const smart = () => {
    const i = parse(nl)
    if (i.kind === 'leave_request') setModal({ typeId: i.typeId, from: i.from, to: i.to, hours: i.hours })
    else {
      const d = parseDates(nl)
      if (d) setModal({ typeId: 'vac', from: dayKey(d[0]), to: dayKey(d[1]) })
      else toast({ title: 'No he encontrado fechas', body: 'Prueba «vacaciones del 22 al 26 de diciembre» o «el viernes asuntos propios».', tone: 'warn' })
    }
    setNl('')
  }

  return (
    <div>
      <PageHeader
        icon={<CalendarDays size={19} />}
        title="Ausencias"
        subtitle={`Ciclo ${year} · asignación desde ${fmt(parseDay(me.hiredAt), 'd MMM yyyy')}`}
        actions={<button className="btn-brand" onClick={() => setModal({ typeId: 'vac', from: dayKey(new Date()), to: dayKey(new Date()) })}><Plus size={15} /> Solicitar ausencia</button>}
      />

      <form onSubmit={(e) => { e.preventDefault(); smart() }} className="aurora-border rounded-2xl bg-surface shadow-card flex items-center gap-3 px-4 h-14 mb-5">
        <Sparkles size={17} className="text-brand shrink-0" />
        <input value={nl} onChange={(e) => setNl(e.target.value)} className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted" placeholder="Descríbelo: «me cojo del 22 al 26 de diciembre», «el jueves médico 3 horas», «asuntos propios el viernes»" />
        <button className="btn-primary h-8" disabled={!nl.trim()}>Preparar</button>
      </form>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        {TIME_OFF_TYPES.map((t) => {
          const u = usage[t.id]
          const left = t.allowance == null ? null : t.allowance - u.used - u.pending
          return (
            <button key={t.id} onClick={() => setModal({ typeId: t.id, from: dayKey(new Date()), to: dayKey(new Date()), hours: t.unit === 'horas' ? 2 : undefined })} className="card p-4 text-left hover:shadow-pop transition group">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="text-lg">{t.emoji}</span> {t.name}
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="kpi">{left ?? '∞'}</span>
                <span className="text-xs text-muted">{left == null ? 'ilimitado' : `${t.unit} disponibles`}</span>
              </div>
              {t.allowance != null && (
                <div className="mt-3 h-1.5 rounded-full bg-sunken overflow-hidden flex">
                  <div style={{ width: `${(u.used / t.allowance) * 100}%`, background: t.color }} />
                  <div style={{ width: `${(u.pending / t.allowance) * 100}%`, background: t.color, opacity: 0.35 }} />
                </div>
              )}
              <div className="text-[11px] text-muted mt-2">{u.used} usados{u.pending ? ` · ${u.pending} pendientes` : ''}{t.allowance != null ? ` · ${t.allowance} al año` : ''}</div>
            </button>
          )
        })}
      </div>

      <div className="grid xl:grid-cols-[1fr_340px] gap-5">
        <Section
          title={`Calendario ${year}`}
          action={
            <div className="flex">
              <button className="btn-ghost px-2" onClick={() => setYear(year - 1)} aria-label="Año anterior"><ChevronLeft size={16} /></button>
              <button className="btn-ghost" onClick={() => setYear(new Date().getFullYear())}>Hoy</button>
              <button className="btn-ghost px-2" onClick={() => setYear(year + 1)} aria-label="Año siguiente"><ChevronRight size={16} /></button>
            </div>
          }
        >
          <YearCalendar year={year} empId={me.id} reqs={s.requests} onPick={(k) => setModal({ typeId: 'vac', from: k, to: k })} />
          <div className="flex flex-wrap gap-3 mt-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand/15 ring-1 ring-brand/30" /> Festivo</span>
            {TIME_OFF_TYPES.slice(0, 4).map((t) => <span key={t.id} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: t.color }} /> {t.name}</span>)}
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-dashed border-muted" /> Pendiente</span>
          </div>
        </Section>

        <div className="space-y-5">
          <Section title="Mis solicitudes">
            <div className="space-y-1">
              {mine.slice(0, 8).map((r) => <ReqRow key={r.id} r={r} onCancel={r.status === 'pending' ? () => s.cancelRequest(r.id) : undefined} />)}
            </div>
          </Section>
          <TeamOut />
        </div>
      </div>

      <RequestModal init={modal} onClose={() => setModal(null)} />
    </div>
  )
}

function ReqRow({ r, onCancel }: { r: TimeOffRequest; onCancel?: () => void }) {
  const t = TIME_OFF_TYPES.find((x) => x.id === r.typeId)!
  const n = r.hours ? `${r.hours} h` : `${workingDays(parseDay(r.from), parseDay(r.to)).length} d`
  return (
    <div className="flex items-center gap-3 py-2 group">
      <span className="h-8 w-8 rounded-lg grid place-items-center text-base" style={{ background: t.color + '1a' }}>{t.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{t.name} <span className="text-muted font-normal">· {n}</span></div>
        <div className="text-xs text-muted">{r.from === r.to ? cap(fmt(parseDay(r.from), "EEE d MMM yyyy")) : `${fmt(parseDay(r.from), 'd MMM')} → ${fmt(parseDay(r.to), 'd MMM yyyy')}`}</div>
      </div>
      <span className={cx('chip', r.status === 'approved' ? 'bg-ok/10 text-ok' : r.status === 'pending' ? 'bg-warn/10 text-warn' : 'bg-bad/10 text-bad')}>{r.status === 'approved' ? 'Aprobada' : r.status === 'pending' ? 'Pendiente' : 'Rechazada'}</span>
      {onCancel && <button onClick={onCancel} className="opacity-0 group-hover:opacity-100 text-muted hover:text-bad transition" aria-label="Cancelar"><Trash2 size={14} /></button>}
    </div>
  )
}

function TeamOut() {
  const s = useStore()
  const me = useMe()
  const upcoming = s.requests.filter((r) => r.empId !== me.id && r.status !== 'rejected' && r.to >= dayKey(new Date())).sort((a, b) => a.from.localeCompare(b.from)).slice(0, 6)
  return (
    <Section title="Quién estará fuera" icon={<Users size={15} />}>
      <div className="space-y-2.5">
        {upcoming.map((r) => {
          const e = s.employees.find((x) => x.id === r.empId)!
          const t = TIME_OFF_TYPES.find((x) => x.id === r.typeId)!
          return (
            <div key={r.id} className="flex items-center gap-2.5">
              <Avatar emp={e} size={28} />
              <div className="flex-1 min-w-0 text-sm truncate">{e.name.split(' ')[0]} <span className="text-muted">· {t.emoji} {fmt(parseDay(r.from), 'd MMM')}{r.from !== r.to && ` → ${fmt(parseDay(r.to), 'd MMM')}`}</span></div>
              {r.status === 'pending' && <span className="chip bg-warn/10 text-warn">pendiente</span>}
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function YearCalendar({ year, empId, reqs, onPick }: { year: number; empId: string; reqs: TimeOffRequest[]; onPick: (k: string) => void }) {
  const today = dayKey(new Date())
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-6 gap-y-5">
      {Array.from({ length: 12 }, (_, m) => {
        const first = new Date(year, m, 1)
        const pad = isoDow(first) - 1
        return (
          <div key={m}>
            <div className="text-xs font-semibold mb-1.5">{cap(fmt(first, 'MMMM'))}</div>
            <div className="grid grid-cols-7 gap-0.5 text-[10px]">
              {Array.from({ length: pad }, (_, i) => <span key={'p' + i} />)}
              {monthDays(first).map((d) => {
                const k = dayKey(d)
                const r = reqs.find((x) => x.empId === empId && x.status !== 'rejected' && x.from <= k && x.to >= k)
                const t = r && TIME_OFF_TYPES.find((x) => x.id === r.typeId)
                const we = isoDow(d) > 5
                const hol = HOLIDAYS[k]
                return (
                  <button
                    key={k}
                    title={hol ?? t?.name}
                    onClick={() => !we && !hol && onPick(k)}
                    className={cx('aspect-square rounded-md grid place-items-center tabular-nums transition', we ? 'text-muted/60' : 'hover:bg-sunken', hol && 'bg-brand/15 text-brand font-semibold', k === today && 'ring-2 ring-ink', r?.status === 'pending' && 'border border-dashed')}
                    style={t && !we && !hol ? (r!.status === 'approved' ? { background: t.color, color: 'white' } : { borderColor: t.color, color: t.color }) : undefined}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RequestModal({ init, onClose }: { init: { typeId: string; from: string; to: string; hours?: number; note?: string } | null; onClose: () => void }) {
  const s = useStore()
  const me = useMe()
  const [f, setF] = useState(init)
  const [last, setLast] = useState(init)
  if (init !== last) {
    setLast(init)
    setF(init)
  }
  const t = f && TIME_OFF_TYPES.find((x) => x.id === f.typeId)!
  const preview = useMemo(() => {
    if (!f || !t) return null
    const a = parseDay(f.from)
    const b = parseDay(f.to < f.from ? f.from : f.to)
    const wd = workingDays(a, b)
    const hols = Object.entries(HOLIDAYS).filter(([k]) => k >= f.from && k <= f.to)
    const u = timeOffUsage(me.id, s.requests, a.getFullYear())[t.id]
    const need = t.unit === 'horas' ? f.hours ?? 0 : wd.length
    const left = t.allowance == null ? Infinity : t.allowance - u.used - u.pending
    const team = s.employees.filter((e) => e.team === me.team && e.id !== me.id)
    const clash = team.filter((e) => wd.some((d) => absenceOn(e.id, dayKey(d), s.requests)) || s.requests.some((r) => r.empId === e.id && r.status === 'pending' && r.from <= f.to && r.to >= f.from))
    // Sugerencia de «puente»: si el rango toca un festivo, propone completar
    let tip = ''
    for (const [k, name] of Object.entries(HOLIDAYS)) {
      const h = parseDay(k)
      if (Math.abs(h.getTime() - a.getTime()) > 10 * 864e5) continue
      const dow = isoDow(h)
      if (dow === 2) tip = `💡 ${name} cae en martes: pidiendo solo el lunes ${fmt(new Date(h.getTime() - 864e5), 'd')} tendrías 4 días seguidos.`
      if (dow === 4) tip = `💡 ${name} cae en jueves: pidiendo el viernes ${fmt(new Date(h.getTime() + 864e5), 'd')} encadenas 4 días libres.`
    }
    return { wd, hols, need, left, clash, coverage: Math.round(((team.length - clash.length) / Math.max(1, team.length)) * 100), tip }
  }, [f, t, s.requests]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!f || !t) return <Modal open={false} onClose={onClose}>{null}</Modal>
  const submit = () => {
    s.requestTimeOff({ typeId: f.typeId, from: f.from, to: f.to < f.from ? f.from : f.to, hours: t.unit === 'horas' ? f.hours : undefined, note: f.note })
    toast({ title: 'Solicitud enviada', body: `${t.name} · tu responsable recibirá un aviso.`, tone: 'ai' })
    onClose()
  }
  return (
    <Modal open={!!init} onClose={onClose} title="Solicitar ausencia" icon={<span className="text-xl">{t.emoji}</span>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {TIME_OFF_TYPES.map((x) => (
            <button key={x.id} onClick={() => setF({ ...f, typeId: x.id, hours: x.unit === 'horas' ? f.hours ?? 2 : undefined })} className={cx('chip h-8 px-3 text-xs border transition', x.id === f.typeId ? 'border-transparent text-white' : 'border-line bg-surface hover:bg-sunken text-ink')} style={x.id === f.typeId ? { background: x.color } : undefined}>
              {x.emoji} {x.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Desde</label><input type="date" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} /></div>
          <div><label className="label">{t.unit === 'horas' ? 'Día' : 'Hasta'}</label><input type="date" className="input" value={f.to} disabled={t.unit === 'horas'} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
        </div>
        {t.unit === 'horas' && <div><label className="label">Horas</label><input type="number" min={0.5} step={0.5} className="input" value={f.hours ?? 2} onChange={(e) => setF({ ...f, hours: +e.target.value, to: f.from })} /></div>}
        <div><label className="label">Nota (opcional)</label><input className="input" value={f.note ?? ''} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ej.: viaje familiar" /></div>
        {preview && (
          <AiNote>
            <div className="space-y-1">
              <div><b>{t.unit === 'horas' ? `${preview.need} h` : `${preview.wd.length} día${preview.wd.length !== 1 ? 's' : ''} laborable${preview.wd.length !== 1 ? 's' : ''}`}</b>{preview.hols.length ? ` (descontados ${preview.hols.length} festivo${preview.hols.length > 1 ? 's' : ''})` : ''}{preview.left !== Infinity && ` · te quedarán ${preview.left - preview.need} ${t.unit}`}</div>
              <div className="text-muted">Cobertura de {me.team}: {preview.coverage}%{preview.clash.length ? ` · también fuera: ${preview.clash.map((e) => e.name.split(' ')[0]).join(', ')}` : ' · sin solapamientos'}</div>
              {preview.need > preview.left && <div className="text-bad">No tienes saldo suficiente.</div>}
              {preview.tip && <div>{preview.tip}</div>}
            </div>
          </AiNote>
        )}
        <div className="flex gap-2 justify-end pt-1">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-brand" onClick={submit} disabled={!preview || preview.need <= 0 || preview.need > preview.left}>Enviar solicitud</button>
        </div>
      </div>
    </Modal>
  )
}
