import { Users, Search, Home as HomeIcon, MapPin, Coffee, Moon, Plane } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useNow } from '../lib/hooks'
import { byDay, summarize, absenceOn, plannedMin } from '../lib/attendance'
import { dayKey, fmt, hm } from '../lib/time'
import { MapView } from '../components/MapView'
import { AiNote, Avatar, PageHeader, Section, cx } from '../components/ui'
import { TIME_OFF_TYPES } from '../data/seed'
import { go } from '../lib/nav'

type F = 'all' | 'office' | 'remote' | 'break' | 'off'

export function TeamPage() {
  const s = useStore()
  const now = useNow(20000)
  const [q, setQ] = useState('')
  const [f, setF] = useState<F>('all')
  const [sel, setSel] = useState<string>()
  const [zoneView, setZoneView] = useState<string>(() => s.zones.find((z) => z.id === s.employees.find((e) => e.id === s.meId)?.zoneId)?.id ?? 'all')
  const k = dayKey(now)
  const rows = useMemo(
    () =>
      s.employees.map((e) => {
        const sm = summarize(byDay(s.punches, e.id).get(k) ?? [], now)
        const last = [...sm.punches].reverse().find((p) => p.lat != null)
        const off = absenceOn(e.id, k, s.requests)
        const remote = !!sm.punches.at(-1)?.remote
        const kind: F = off && !off.hours ? 'off' : sm.state === 'break' ? 'break' : sm.state === 'working' ? (remote ? 'remote' : 'office') : 'off'
        const late = sm.state === 'none' && !off && plannedMin(e, new Date(now), s.requests) > 0 && new Date(now).getHours() * 60 + new Date(now).getMinutes() > Number(e.start.slice(0, 2)) * 60 + Number(e.start.slice(3)) + 20
        return { e, sm, last, off, remote, kind, late }
      }),
    [s.punches, s.requests, k, Math.floor(now / 60000)], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const counts = { all: rows.length, office: rows.filter((r) => r.kind === 'office').length, remote: rows.filter((r) => r.kind === 'remote').length, break: rows.filter((r) => r.kind === 'break').length, off: rows.filter((r) => r.kind === 'off').length }
  const list = rows.filter((r) => (f === 'all' || r.kind === f) && r.e.name.toLowerCase().includes(q.toLowerCase()))
  const late = rows.filter((r) => r.late)
  const color = (r: (typeof rows)[number]) => (r.kind === 'office' ? '#6366f1' : r.kind === 'remote' ? '#10b981' : r.kind === 'break' ? '#f59e0b' : '#9ca3af')

  const pins = rows
    .filter((r) => r.last && (r.sm.state === 'working' || r.sm.state === 'break'))
    .map((r) => ({
      id: r.e.id,
      lat: r.last!.lat!,
      lng: r.last!.lng!,
      color: color(r),
      label: `${r.e.name} · ${r.kind === 'remote' ? 'remoto' : r.kind === 'break' ? 'en pausa' : 'oficina'} · desde ${fmt(r.sm.first!, 'HH:mm')}`,
      html: `<div style="position:relative;width:34px;height:34px;border-radius:999px;border:3px solid ${color(r)};background:linear-gradient(135deg,hsl(${r.e.hue} 75% 62%),hsl(${(r.e.hue + 40) % 360} 70% 50%));color:white;display:grid;place-items:center;font:600 11px Inter;box-shadow:0 4px 14px rgb(0 0 0 / .2)">${r.e.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</div>`,
    }))
  const selRow = rows.find((r) => r.e.id === sel)
  const zv = s.zones.find((z) => z.id === zoneView)
  const fit: [number, number][] | undefined = selRow?.last ? [[selRow.last.lat!, selRow.last.lng!]] : zv ? [[zv.lat, zv.lng]] : undefined
  const inZone = (zid: string) => rows.filter((r) => r.last?.zoneId === zid && (r.sm.state === 'working' || r.sm.state === 'break')).length

  return (
    <div>
      <PageHeader icon={<Users size={19} />} title="Equipo en vivo" subtitle={`${counts.office + counts.remote + counts.break} de ${counts.all} personas activas ahora · actualizado ${fmt(now, 'HH:mm')}`} />
      <div className="grid sm:grid-cols-4 gap-4 mb-5">
        {(
          [
            ['office', 'En oficina', <MapPin size={15} key="o" />, 'text-indigo-500 bg-indigo-500/10'],
            ['remote', 'Teletrabajo', <HomeIcon size={15} key="r" />, 'text-emerald-500 bg-emerald-500/10'],
            ['break', 'En pausa', <Coffee size={15} key="b" />, 'text-amber-500 bg-amber-500/10'],
            ['off', 'Fuera / sin fichar', <Moon size={15} key="f" />, 'text-muted bg-sunken'],
          ] as const
        ).map(([id, label, icon, tone]) => (
          <button key={id} onClick={() => setF(f === id ? 'all' : id)} className={cx('card p-4 text-left flex items-center gap-3 transition', f === id && 'ring-2 ring-brand')}>
            <span className={cx('h-9 w-9 rounded-xl grid place-items-center', tone)}>{icon}</span>
            <div><div className="kpi text-xl">{counts[id]}</div><div className="text-xs text-muted">{label}</div></div>
          </button>
        ))}
      </div>

      {!!late.length && (
        <AiNote className="mb-5">
          {late.map((r) => r.e.name.split(' ')[0]).join(', ')} {late.length > 1 ? 'aún no han' : 'aún no ha'} fichado y {late.length > 1 ? 'su' : 'su'} hora de entrada ya pasó hace más de 20 min. ¿Les envío un recordatorio amable?
        </AiNote>
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <section className="card overflow-hidden h-[520px] relative">
          <div className="absolute z-[500] top-3 left-14 right-3 flex flex-wrap gap-1.5">
            {[{ id: 'all', name: 'Todas las sedes', n: pins.length }, ...s.zones.map((z) => ({ id: z.id, name: z.name.split(' · ')[0], n: inZone(z.id) }))].map((z) => (
              <button key={z.id} onClick={() => { setZoneView(z.id); setSel(undefined) }} className={cx('chip h-8 px-3 text-xs shadow-card border transition', zoneView === z.id && !sel ? 'bg-ink text-surface border-transparent' : 'bg-surface/95 border-line text-ink hover:bg-sunken')}>
                {z.name} <span className="opacity-60">{z.n}</span>
              </button>
            ))}
          </div>
          <MapView zones={s.zones} pins={pins} fit={fit} zoom={fit ? (sel ? 17 : 17) : undefined} />
        </section>
        <Section
          className="h-[520px] flex flex-col"
          title={
            <div className="flex items-center gap-2 h-9 px-3 rounded-xl bg-sunken border border-line">
              <Search size={14} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona" className="bg-transparent outline-none text-sm font-normal flex-1" />
            </div>
          }
        >
          <div className="overflow-auto -mx-2 flex-1">
            {list.map((r) => {
              const t = r.off && TIME_OFF_TYPES.find((x) => x.id === r.off!.typeId)
              return (
                <button key={r.e.id} onClick={() => setSel(r.e.id === sel ? undefined : r.e.id)} className={cx('w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition', sel === r.e.id ? 'bg-sunken' : 'hover:bg-sunken/60')}>
                  <Avatar emp={r.e} size={34} ring={r.kind === 'office' ? 'brand' : r.kind === 'remote' ? 'ok' : r.kind === 'break' ? 'warn' : 'muted'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.e.name}</div>
                    <div className="text-xs text-muted truncate">
                      {t ? <><Plane size={10} className="inline" /> {t.name}</> : r.sm.state === 'none' ? (r.late ? <span className="text-warn">Sin fichar · entra a las {r.e.start}</span> : `Entra a las ${r.e.start}`) : r.sm.state === 'done' ? `Salió a las ${fmt(r.sm.last!, 'HH:mm')}` : `${r.kind === 'remote' ? 'Remoto' : s.zones.find((z) => z.id === r.last?.zoneId)?.name ?? 'Fuera de zona'} · desde ${fmt(r.sm.first!, 'HH:mm')}`}
                    </div>
                  </div>
                  <div className="text-xs tabular-nums text-muted">{r.sm.worked ? hm(r.sm.worked) : ''}</div>
                </button>
              )
            })}
          </div>
          {selRow && (
            <div className="border-t border-line pt-3 mt-2 flex gap-2">
              <button className="btn-outline flex-1 h-8 text-xs" onClick={() => go('timesheet')}>Hoja de horas</button>
              <button className="btn-outline flex-1 h-8 text-xs" onClick={() => go('inbox')}>Solicitudes</button>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
