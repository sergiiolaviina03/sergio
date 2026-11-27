import { motion } from 'framer-motion'
import { Coffee, LogIn, LogOut, Play } from 'lucide-react'
import { useMe, useStore } from '../store'
import { useNow, useToday } from '../lib/hooks'
import { clock, fmt, hm } from '../lib/time'
import { plannedMin } from '../lib/attendance'
import { startClock } from './ClockFlow'
import { cx } from './ui'

export function ClockOrb({ size = 248, compact }: { size?: number; compact?: boolean }) {
  const me = useMe()
  const reqs = useStore((s) => s.requests)
  const today = useToday(me.id)
  const now = useNow(1000)
  const planned = plannedMin(me, new Date(now), reqs) || (me.weeklyHours / 5) * 60
  const pct = Math.min(1, today.worked / planned)
  const over = today.worked > planned
  const r = size / 2 - 14
  const C = 2 * Math.PI * r
  const lastBreak = today.segs.filter((s) => s.kind === 'break').at(-1)
  const state = today.state
  const color = state === 'working' ? '#6366f1' : state === 'break' ? '#f59e0b' : state === 'done' ? '#10b981' : '#a1a1b5'
  const main =
    state === 'working' ? { t: 'out' as const, label: 'Fichar salida', icon: <LogOut size={16} /> } : state === 'break' ? { t: 'break_end' as const, label: 'Volver', icon: <Play size={16} /> } : { t: 'in' as const, label: state === 'done' ? 'Volver a entrar' : 'Fichar entrada', icon: <LogIn size={16} /> }
  const breakLeft = Math.max(0, me.breakMin - today.breaks)
  const leaveAt = today.state === 'working' ? now + (Math.max(0, planned - today.worked) + (planned - today.worked > 60 ? breakLeft : 0)) * 60000 : undefined

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {state === 'working' && <div className="absolute inset-6 rounded-full blur-2xl animate-breathe" style={{ background: 'radial-gradient(circle, rgb(99 102 241 / .55), rgb(34 211 238 / .25) 60%, transparent 70%)' }} />}
        <svg width={size} height={size} className="relative -rotate-90">
          <defs>
            <linearGradient id="orb" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#8b5cf6" />
              <stop offset=".6" stopColor="#6366f1" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={10} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={state === 'break' ? '#f59e0b' : over ? '#10b981' : 'url(#orb)'}
            strokeWidth={10}
            strokeLinecap={pct > 0.005 ? 'round' : 'butt'}
            strokeDasharray={C}
            animate={{ strokeDashoffset: C * (1 - pct) }}
            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="flex items-center justify-center gap-1.5 text-xs font-medium" style={{ color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              {state === 'working' ? 'Trabajando' : state === 'break' ? 'En pausa' : state === 'done' ? 'Jornada cerrada' : 'Sin fichar'}
            </div>
            <div className={cx('font-semibold tabular-nums tracking-tight mt-1', compact ? 'text-3xl' : 'text-[40px] leading-none')}>
              {state === 'break' && lastBreak ? clock(lastBreak.to - lastBreak.from) : clock(today.worked * 60000)}
            </div>
            <div className="text-xs text-muted mt-1.5">
              {state === 'break' ? `Llevas ${hm(today.worked)} hoy` : `de ${hm(planned)} · ${Math.round(pct * 100)}%`}
            </div>
            {leaveAt && !compact && <div className="text-[11px] text-muted mt-1">Cuadras a las <b className="text-ink">{fmt(leaveAt, 'HH:mm')}</b></div>}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => startClock(main.t)} className={cx('btn h-11 px-5 rounded-2xl text-white shadow-glow', state === 'working' ? 'bg-ink !text-surface shadow-none' : 'bg-brand')}>
          {main.icon} {main.label}
        </motion.button>
        {state === 'working' && (
          <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} whileTap={{ scale: 0.96 }} onClick={() => startClock('break_start')} className="btn-outline h-11 px-4 rounded-2xl">
            <Coffee size={16} /> Pausa
          </motion.button>
        )}
      </div>
    </div>
  )
}

/** Barra horizontal del día: trabajo, pausas y lo que queda. */
export function DayBar({ segs, from = 7, to = 21, now, plannedEnd }: { segs: { from: number; to: number; kind: 'work' | 'break' }[]; from?: number; to?: number; now?: number; plannedEnd?: number }) {
  if (!segs.length && !now) return <div className="h-2 rounded-full bg-sunken" />
  const base = new Date(segs[0]?.from ?? now!)
  base.setHours(from, 0, 0, 0)
  const span = (to - from) * 3600e3
  const pos = (t: number) => Math.max(0, Math.min(100, ((t - base.getTime()) / span) * 100))
  return (
    <div>
      <div className="relative h-2.5 rounded-full bg-sunken overflow-hidden">
        {segs.map((s, i) => (
          <div key={i} className={cx('absolute top-0 bottom-0 rounded-full', s.kind === 'work' ? 'bg-gradient-to-r from-violet-500 to-indigo-500' : 'bg-amber-400')} style={{ left: `${pos(s.from)}%`, width: `${Math.max(0.6, pos(s.to) - pos(s.from))}%` }} />
        ))}
        {plannedEnd && <div className="absolute top-0 bottom-0 w-0.5 bg-ok" style={{ left: `${pos(plannedEnd)}%` }} />}
        {now && <div className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-ink rounded" style={{ left: `${pos(now)}%` }} />}
      </div>
      <div className="flex justify-between text-[10px] text-muted mt-1 tabular-nums">
        {Array.from({ length: (to - from) / 2 + 1 }, (_, i) => (
          <span key={i}>{String(from + i * 2).padStart(2, '0')}</span>
        ))}
      </div>
    </div>
  )
}
