import { Timer, MapPin, ShieldCheck, Home as HomeIcon, Crosshair, Camera, Radar, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useMe, useStore } from '../store'
import { useNow, useToday } from '../lib/hooks'
import { ClockOrb, DayBar } from '../components/ClockOrb'
import { MapView } from '../components/MapView'
import { AiNote, PageHeader, Section, cx } from '../components/ui'
import { LABEL } from '../components/ClockFlow'
import { evaluate, locate, type Verdict } from '../lib/verify'
import { fmt, hm, isoDow } from '../lib/time'
import { short } from '../lib/ledger'
import { plannedMin } from '../lib/attendance'
import { go } from '../lib/nav'

const FLAG: Record<string, string> = { fuera_de_zona: 'Fuera de zona', precision_baja: 'Precisión baja', posible_ubicacion_simulada: 'Ubicación sospechosa', viaje_imposible: 'Viaje imposible', sin_ubicacion: 'Sin ubicación', demo: 'Demo', sin_selfie: 'Sin selfie', corrección: 'Corrección' }

export function ClockPage() {
  const me = useMe()
  const s = useStore()
  const today = useToday(me.id)
  const now = useNow(15000)
  const [probe, setProbe] = useState<Verdict>()
  const [probing, setProbing] = useState(false)
  const planned = plannedMin(me, new Date(now), s.requests)
  const remoteToday = me.remoteDays.includes(isoDow(new Date(now)))
  const located = today.punches.filter((p) => p.lat != null)
  const last = located.at(-1)

  const test = async () => {
    setProbing(true)
    try {
      const fix = await locate(s.settings, s.zones, me)
      setProbe(evaluate(fix, s.zones, me, s.requests, undefined, s.settings))
    } catch (e) {
      setProbe(evaluate(undefined, s.zones, me, s.requests, undefined, s.settings))
      console.warn(e)
    }
    setProbing(false)
  }

  const fitPts: [number, number][] = probe?.fix ? [[probe.fix.lat, probe.fix.lng]] : located.length ? located.map((p) => [p.lat!, p.lng!]) : []
  const homeZone = s.zones.find((z) => z.id === me.zoneId)
  if (homeZone && !probe) fitPts.push([homeZone.lat, homeZone.lng])

  return (
    <div>
      <PageHeader
        icon={<Timer size={19} />}
        title="Mi jornada"
        subtitle={`${me.start}–${me.end} · ${me.weeklyHours} h/semana · ${remoteToday ? 'hoy teletrabajo' : homeZone?.name}`}
        actions={
          <span className={cx('chip h-7 px-2.5', s.settings.locationMode === 'demo' ? 'bg-warn/10 text-warn' : 'bg-ok/10 text-ok')}>
            <Radar size={12} /> {s.settings.locationMode === 'demo' ? 'GPS simulado (demo)' : 'GPS real'}
          </span>
        }
      />
      <div className="grid lg:grid-cols-[380px_1fr] gap-5">
        <div className="space-y-5">
          <section className="card p-6 grid place-items-center">
            <ClockOrb size={260} />
            <div className="w-full mt-6">
              <DayBar segs={today.segs} now={now} plannedEnd={today.state === 'working' ? now + Math.max(0, planned - today.worked) * 60000 : undefined} />
            </div>
            <div className="grid grid-cols-3 w-full mt-5 text-center">
              <div><div className="text-xs text-muted">Trabajado</div><div className="font-semibold tabular-nums">{hm(today.worked)}</div></div>
              <div><div className="text-xs text-muted">Pausas</div><div className="font-semibold tabular-nums">{hm(today.breaks)}</div></div>
              <div><div className="text-xs text-muted">Restante</div><div className="font-semibold tabular-nums">{hm(Math.max(0, planned - today.worked))}</div></div>
            </div>
          </section>
          {today.state === 'working' && today.worked > 5.5 * 60 && today.breaks < 15 && s.settings.autoBreakReminder && (
            <AiNote>Llevas más de 5 h 30 m sin pausa. A partir de 6 h la ley exige un descanso de 15 min: ¿te paras un momento? ☕</AiNote>
          )}
        </div>

        <div className="space-y-5 min-w-0">
          <section className="card overflow-hidden">
            <div className="h-[300px] relative">
              <MapView
                zones={s.zones}
                fit={fitPts.length ? fitPts : undefined}
                zoom={16}
                accuracy={probe?.fix ? { lat: probe.fix.lat, lng: probe.fix.lng, r: probe.fix.acc } : undefined}
                pins={[
                  ...located.map((p, i) => ({ id: p.id, lat: p.lat!, lng: p.lng!, color: p.type === 'in' ? '#6366f1' : p.type === 'out' ? '#10b981' : '#f59e0b', label: `${LABEL[p.type]} · ${fmt(p.ts, 'HH:mm')}`, pulse: !probe && i === located.length - 1 })),
                  ...(probe?.fix ? [{ id: 'probe', lat: probe.fix.lat, lng: probe.fix.lng, color: probe.inside || probe.remote ? '#10b981' : '#f59e0b', pulse: true, label: 'Tu posición ahora' }] : []),
                ]}
              />
              <button onClick={test} disabled={probing} className="absolute z-[500] top-3 right-3 btn-outline shadow-card">
                {probing ? <Loader2 size={15} className="animate-spin" /> : <Crosshair size={15} />} Comprobar ubicación
              </button>
            </div>
            <div className="p-4 border-t border-line">
              {probe ? (
                <div className="grid sm:grid-cols-3 gap-3">
                  {probe.checks.map((c) => (
                    <div key={c.id} className="flex gap-2 items-start">
                      <span className={cx('mt-1 h-2 w-2 rounded-full shrink-0', c.status === 'ok' ? 'bg-ok' : c.status === 'warn' ? 'bg-warn' : 'bg-bad')} />
                      <div className="text-xs"><div className="font-medium text-sm">{c.label}</div><div className="text-muted">{c.detail}</div></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm text-muted">
                  <MapPin size={16} className="text-brand" />
                  {last ? <>Último fichaje en <b className="text-ink">{last.zoneId ? s.zones.find((z) => z.id === last.zoneId)?.name : last.remote ? 'teletrabajo' : 'ubicación externa'}</b> · ±{last.acc} m</> : 'Cada fichaje guarda tu posición, su precisión y la geovalla en la que estabas.'}
                </div>
              )}
            </div>
          </section>

          <Section title="Fichajes de hoy" icon={<ShieldCheck size={15} />} action={<button onClick={() => go('ledger')} className="text-xs text-muted hover:text-ink">Ver registro sellado</button>}>
            {today.punches.length ? (
              <ol className="relative">
                {today.punches.map((p, i) => (
                  <li key={p.id} className="flex gap-3 pb-4 last:pb-0 relative">
                    {i < today.punches.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-line" />}
                    <span className={cx('h-8 w-8 rounded-full grid place-items-center text-white shrink-0 text-xs font-semibold', p.type === 'in' ? 'bg-indigo-500' : p.type === 'out' ? 'bg-emerald-500' : 'bg-amber-500')}>
                      {p.selfie ? <img src={p.selfie} className="h-8 w-8 rounded-full object-cover" alt="" /> : p.remote ? <HomeIcon size={14} /> : <MapPin size={14} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{LABEL[p.type]}</span>
                        <span className="text-sm tabular-nums">{fmt(p.ts, 'HH:mm:ss')}</span>
                        {p.flags.map((f) => <span key={f} className={cx('chip', f === 'demo' ? 'bg-sunken text-muted' : 'bg-warn/10 text-warn')}>{FLAG[f] ?? f}</span>)}
                        {p.selfie && <span className="chip bg-brand/10 text-brand"><Camera size={10} /> selfie</span>}
                      </div>
                      <div className="text-xs text-muted mt-0.5 truncate">
                        {p.zoneId ? s.zones.find((z) => z.id === p.zoneId)?.name : p.remote ? 'Teletrabajo' : p.lat != null ? 'Fuera de zona' : 'Sin ubicación'}
                        {p.acc != null && ` · ±${p.acc} m`} · {p.method === 'copilot' ? 'vía copiloto' : p.method === 'kiosk' ? 'quiosco' : p.method === 'correction' ? 'corrección aprobada' : 'app'} · <span className="font-mono">#{p.seq} {short(p.hash)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-sm text-muted">Todavía no has fichado hoy. Pulsa «Fichar entrada» o dile al copiloto <i>«empiezo»</i>.</div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
