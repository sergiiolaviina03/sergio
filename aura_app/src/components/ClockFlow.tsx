import { create } from 'zustand'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, AlertTriangle, X, MapPin, ShieldCheck, Fingerprint, Camera, Loader2, Home } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { Punch, PunchType } from '../types'
import { evaluate, locate, type Verdict } from '../lib/verify'
import { MapView } from './MapView'
import { cx, toast } from './ui'
import { short } from '../lib/ledger'
import { fmt } from '../lib/time'
import { fmtDist } from '../lib/geo'

type Stage = 'idle' | 'locating' | 'checking' | 'selfie' | 'sealing' | 'done' | 'blocked' | 'error'
type FlowState = { open: boolean; type: PunchType; stage: Stage; verdict?: Verdict; punch?: Punch; error?: string; via: 'app' | 'copilot' | 'kiosk'; empId?: string }

export const LABEL: Record<PunchType, string> = { in: 'Entrada', out: 'Salida', break_start: 'Inicio de pausa', break_end: 'Fin de pausa' }

export const useClockFlow = create<FlowState & { start: (t: PunchType, via?: FlowState['via'], empId?: string) => void; close: () => void; set: (p: Partial<FlowState>) => void }>((set) => ({
  open: false,
  type: 'in',
  stage: 'idle',
  via: 'app',
  start: (type, via = 'app', empId) => set({ open: true, type, stage: 'locating', verdict: undefined, punch: undefined, error: undefined, via, empId }),
  close: () => set({ open: false, stage: 'idle' }),
  set: (p) => set(p),
}))

export const startClock = (t: PunchType, via?: FlowState['via'], empId?: string) => useClockFlow.getState().start(t, via, empId)

export function ClockFlow() {
  const f = useClockFlow()
  const store = useStore()
  const running = useRef(false)

  useEffect(() => {
    if (!f.open || f.stage !== 'locating' || running.current) return
    running.current = true
    ;(async () => {
      const s = useStore.getState()
      const emp = s.employees.find((e) => e.id === (f.empId ?? s.meId))!
      let fix
      try {
        fix = await locate(s.settings, s.zones, emp)
      } catch (e) {
        fix = undefined
        f.set({ error: (e as Error).message })
      }
      const last = [...s.punches].reverse().find((p) => p.empId === emp.id)
      const v = evaluate(fix, s.zones, emp, s.requests, last, s.settings)
      f.set({ stage: 'checking', verdict: v })
      await wait(1100)
      if (v.blocked) {
        f.set({ stage: 'blocked' })
        running.current = false
        return
      }
      if (s.settings.requireSelfie && f.via !== 'kiosk') {
        f.set({ stage: 'selfie' })
        running.current = false
        return
      }
      seal(v)
      running.current = false
    })()
  }, [f.open, f.stage]) // eslint-disable-line react-hooks/exhaustive-deps

  const seal = async (v: Verdict, selfie?: string) => {
    const st = useClockFlow.getState()
    st.set({ stage: 'sealing' })
    await wait(550)
    const p = useStore.getState().punch(st.type, {
      empId: st.empId,
      lat: v.fix ? +v.fix.lat.toFixed(6) : undefined,
      lng: v.fix ? +v.fix.lng.toFixed(6) : undefined,
      acc: v.fix ? Math.round(v.fix.acc) : undefined,
      zoneId: v.fix ? (v.zone?.id ?? null) : undefined,
      dist: v.dist ? Math.round(v.dist) : undefined,
      remote: v.remote,
      method: st.via === 'copilot' ? 'copilot' : st.via === 'kiosk' ? 'kiosk' : 'app',
      selfie,
      flags: [...v.flags, ...(v.fix?.simulated ? ['demo'] : []), ...(selfie === undefined && useStore.getState().settings.requireSelfie && st.via !== 'kiosk' ? ['sin_selfie'] : [])],
    })
    st.set({ stage: 'done', punch: p })
    if (navigator.vibrate) navigator.vibrate([12, 40, 18])
    await wait(1700)
    if (useClockFlow.getState().punch?.id === p.id) {
      useClockFlow.getState().close()
      const emp = useStore.getState().employees.find((e) => e.id === p.empId)!
      toast({ title: `${LABEL[p.type]} registrada · ${fmt(p.ts, 'HH:mm')}`, body: `${emp.name.split(' ')[0]} · ${v.zone ? v.zone.name : v.remote ? 'Teletrabajo' : 'Fuera de zona'} · sello ${short(p.hash)}`, tone: v.flags.length ? 'warn' : 'ok' })
    }
  }

  const v = f.verdict
  const zones = store.zones
  return (
    <AnimatePresence>
      {f.open && (
        <motion.div className="fixed inset-0 z-[55] grid place-items-end sm:place-items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => ['done', 'blocked', 'error'].includes(f.stage) && f.close()} />
          <motion.div
            className="relative w-full sm:max-w-[420px] card shadow-pop overflow-hidden rounded-b-none sm:rounded-2xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="relative h-44 bg-sunken">
              {v?.fix ? (
                <MapView
                  interactive={false}
                  zones={zones}
                  zoom={v.inside ? 17 : 15}
                  fit={v.zone ? [[v.fix.lat, v.fix.lng], [v.zone.lat, v.zone.lng]] : [[v.fix.lat, v.fix.lng]]}
                  accuracy={{ lat: v.fix.lat, lng: v.fix.lng, r: v.fix.acc }}
                  pins={[{ id: 'me', lat: v.fix.lat, lng: v.fix.lng, color: v.inside || v.remote ? '#10b981' : '#f59e0b', pulse: true }]}
                />
              ) : (
                <Scanner />
              )}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent pointer-events-none z-[500]" />
              <button className="absolute top-3 right-3 z-[600] h-8 w-8 rounded-full bg-surface/90 border border-line grid place-items-center" onClick={f.close} aria-label="Cerrar">
                <X size={15} />
              </button>
            </div>
            <div className="px-5 pb-5 -mt-4 relative z-[600]">
              <div className="text-xs font-medium text-muted uppercase tracking-wider">{LABEL[f.type]}{f.via === 'kiosk' ? ' · quiosco' : f.via === 'copilot' ? ' · copiloto' : ''}</div>
              <div className="text-lg font-semibold mt-0.5">
                {f.stage === 'locating' && 'Localizando…'}
                {f.stage === 'checking' && 'Verificando fichaje…'}
                {f.stage === 'selfie' && 'Confirma que eres tú'}
                {f.stage === 'sealing' && 'Sellando en el registro…'}
                {f.stage === 'done' && (
                  <span className="flex items-center gap-2">
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-6 w-6 rounded-full bg-ok text-white grid place-items-center">
                      <Check size={15} strokeWidth={3} />
                    </motion.span>
                    {LABEL[f.type]} a las {fmt(f.punch!.ts, 'HH:mm:ss')}
                  </span>
                )}
                {f.stage === 'blocked' && 'Fichaje bloqueado por geovalla'}
              </div>
              {f.error && <div className="text-xs text-warn mt-1">{f.error}. Puedes activar el modo demo en Ajustes.</div>}

              <div className="mt-4 space-y-2">
                {(v?.checks ?? []).map((c, i) => (
                  <motion.div key={c.id + i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.18 }} className="flex items-start gap-2.5 text-sm">
                    <span className={cx('mt-0.5 h-5 w-5 rounded-full grid place-items-center shrink-0', c.status === 'ok' ? 'bg-ok/15 text-ok' : c.status === 'warn' ? 'bg-warn/15 text-warn' : 'bg-bad/15 text-bad')}>
                      {c.status === 'ok' ? <Check size={12} strokeWidth={3} /> : <AlertTriangle size={11} strokeWidth={2.5} />}
                    </span>
                    <span className="flex-1">
                      <span className="font-medium">{c.label}</span> <span className="text-muted">· {c.detail}</span>
                    </span>
                  </motion.div>
                ))}
                {!v && (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Loader2 size={15} className="animate-spin" /> Obteniendo posición GPS de alta precisión
                  </div>
                )}
              </div>

              {f.stage === 'selfie' && v && <Selfie onDone={(img) => seal(v, img)} />}

              {(f.stage === 'sealing' || f.stage === 'done') && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl bg-sunken border border-line px-3 py-2.5 flex items-center gap-2.5">
                  <ShieldCheck size={16} className="text-brand shrink-0" />
                  <div className="text-xs flex-1 min-w-0">
                    <div className="font-medium">Registro inalterable</div>
                    <div className="font-mono text-muted truncate">{f.punch ? `#${f.punch.seq} · ${f.punch.hash}` : 'calculando SHA-256…'}</div>
                  </div>
                </motion.div>
              )}

              {v && (f.stage === 'done' || f.stage === 'checking') && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                  {v.remote ? <Home size={13} /> : <MapPin size={13} />}
                  {v.zone ? v.zone.name : v.remote ? 'Teletrabajo' : v.dist ? `A ${fmtDist(v.dist)} del centro más cercano` : 'Sin ubicación'}
                  <span className="ml-auto flex items-center gap-1">
                    <Fingerprint size={13} /> Confianza {v.score}%
                  </span>
                </div>
              )}
              {f.stage === 'blocked' && (
                <div className="mt-4 flex gap-2">
                  <button className="btn-outline flex-1" onClick={f.close}>Cerrar</button>
                  <button className="btn-primary flex-1" onClick={() => f.set({ stage: 'locating', verdict: undefined })}>Reintentar</button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Scanner() {
  return (
    <div className="absolute inset-0 grid place-items-center aurora-bg overflow-hidden">
      <div className="relative h-28 w-28">
        {[0, 1, 2].map((i) => (
          <span key={i} className="absolute inset-0 rounded-full border border-brand/40 animate-ping2" style={{ animationDelay: `${i * 0.6}s` }} />
        ))}
        <div className="absolute inset-8 rounded-full bg-brand/90 grid place-items-center text-white shadow-glow">
          <MapPin size={20} />
        </div>
      </div>
    </div>
  )
}

function Selfie({ onDone }: { onDone: (img?: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState<string>()
  const [stream, setStream] = useState<MediaStream>()
  useEffect(() => {
    let s: MediaStream | undefined
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user', width: 320, height: 320 } })
      .then((m) => {
        s = m
        setStream(m)
        if (video.current) video.current.srcObject = m
      })
      .catch(() => setErr('No hay cámara disponible o el permiso fue denegado.'))
    if (!navigator.mediaDevices) setErr('Este navegador no permite usar la cámara.')
    return () => s?.getTracks().forEach((t) => t.stop())
  }, [])
  const snap = () => {
    const c = document.createElement('canvas')
    c.width = c.height = 120
    const v = video.current!
    const s = Math.min(v.videoWidth, v.videoHeight)
    c.getContext('2d')!.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, 120, 120)
    stream?.getTracks().forEach((t) => t.stop())
    onDone(c.toDataURL('image/jpeg', 0.7))
  }
  return (
    <div className="mt-4">
      {err ? (
        <div className="text-xs text-warn mb-3">{err} El fichaje quedará marcado «sin selfie».</div>
      ) : (
        <div className="relative mx-auto h-40 w-40 rounded-full overflow-hidden aurora-border">
          <video ref={video} autoPlay playsInline muted className="h-full w-full object-cover -scale-x-100" />
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button className="btn-outline flex-1" onClick={() => onDone(undefined)}>Omitir</button>
        <button className="btn-brand flex-1" disabled={!!err || !stream} onClick={snap}>
          <Camera size={15} /> Capturar
        </button>
      </div>
    </div>
  )
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
