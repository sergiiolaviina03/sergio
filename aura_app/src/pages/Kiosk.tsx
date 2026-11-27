import { Delete, LogOut, X, Coffee, LogIn, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { useNow } from '../lib/hooks'
import { byDay, summarize } from '../lib/attendance'
import { cap, dayKey, fmt, hm } from '../lib/time'
import { Avatar } from '../components/ui'
import { startClock, useClockFlow } from '../components/ClockFlow'
import { go } from '../lib/nav'
import type { Employee } from '../types'

export function KioskPage() {
  const s = useStore()
  const now = useNow(1000)
  const [pin, setPin] = useState('')
  const [emp, setEmp] = useState<Employee>()
  const [err, setErr] = useState(false)
  const flowOpen = useClockFlow((f) => f.open)
  const zone = s.zones.find((z) => z.id === s.settings.demoSpot) ?? s.zones[0]

  useEffect(() => {
    if (pin.length < 4) return
    const e = s.employees.find((x) => x.pin === pin)
    if (e) setEmp(e)
    else {
      setErr(true)
      setTimeout(() => setErr(false), 600)
    }
    setPin('')
  }, [pin]) // eslint-disable-line react-hooks/exhaustive-deps

  // Vuelve al teclado tras fichar o por inactividad
  useEffect(() => {
    if (!emp || flowOpen) return
    const t = setTimeout(() => setEmp(undefined), 9000)
    return () => clearTimeout(t)
  }, [emp, flowOpen])

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p + e.key).slice(0, 4))
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  const sm = emp ? summarize(byDay(s.punches, emp.id).get(dayKey(now)) ?? [], now) : undefined
  const act = (t: Parameters<typeof startClock>[0]) => {
    startClock(t, 'kiosk', emp!.id)
    setTimeout(() => setEmp(undefined), 2600)
  }

  return (
    <div className="dark min-h-screen bg-[#07070d] text-white relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(800px 500px at 20% 10%, rgb(124 58 237 / .25), transparent 60%), radial-gradient(700px 500px at 90% 90%, rgb(6 182 212 / .18), transparent 60%)' }} />
      <header className="relative flex items-center gap-3 p-6">
        <img src="/aura.svg" className="h-9 w-9" alt="" />
        <div className="leading-tight"><div className="font-semibold">Aura · Quiosco</div><div className="text-xs text-white/50">{zone.name}</div></div>
        <button onClick={() => go('home')} className="ml-auto h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm flex items-center gap-2"><X size={15} /> Salir</button>
      </header>
      <div className="relative flex-1 grid lg:grid-cols-2 items-center gap-10 px-6 pb-10 max-w-6xl mx-auto w-full">
        <div className="text-center lg:text-left">
          <div className="text-white/50 text-lg">{cap(fmt(now, "EEEE, d 'de' MMMM"))}</div>
          <div className="text-[88px] sm:text-[120px] font-semibold tabular-nums tracking-tighter leading-none mt-2">{fmt(now, 'HH:mm')}<span className="text-white/30 text-5xl sm:text-6xl">{fmt(now, ':ss')}</span></div>
          <div className="text-white/50 mt-4">Introduce tu PIN para fichar · demo: 2222, 3333, 7777…</div>
        </div>
        <div className="mx-auto w-full max-w-[360px]">
          <AnimatePresence mode="wait">
            {!emp ? (
              <motion.div key="pad" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1, x: err ? [0, -12, 12, -8, 8, 0] : 0 }} exit={{ opacity: 0, scale: 0.97 }}>
                <div className="flex justify-center gap-4 mb-8">
                  {[0, 1, 2, 3].map((i) => <span key={i} className={`h-4 w-4 rounded-full transition ${i < pin.length ? 'bg-white scale-110' : 'bg-white/15'} ${err ? '!bg-red-500' : ''}`} />)}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
                    k ? (
                      <motion.button whileTap={{ scale: 0.92 }} key={i} onClick={() => (k === '⌫' ? setPin(pin.slice(0, -1)) : setPin((pin + k).slice(0, 4)))} className="h-20 rounded-2xl bg-white/[.06] hover:bg-white/10 border border-white/10 text-2xl font-medium grid place-items-center">
                        {k === '⌫' ? <Delete size={22} /> : k}
                      </motion.button>
                    ) : <span key={i} />,
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key="emp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-3xl bg-white/[.06] border border-white/10 p-6 text-center">
                <div className="flex justify-center"><Avatar emp={emp} size={72} /></div>
                <div className="text-2xl font-semibold mt-4">Hola, {emp.name.split(' ')[0]}</div>
                <div className="text-white/50 text-sm mt-1">{sm!.state === 'none' ? 'Aún no has fichado hoy' : sm!.state === 'working' ? `Trabajando · ${hm(sm!.worked)}` : sm!.state === 'break' ? 'En pausa' : `Jornada cerrada · ${hm(sm!.worked)}`}</div>
                <div className="grid gap-2.5 mt-6">
                  {(sm!.state === 'none' || sm!.state === 'done') && <button onClick={() => act('in')} className="h-14 rounded-2xl text-lg font-medium flex items-center justify-center gap-2" style={{ background: 'linear-gradient(120deg,#7c3aed,#6366f1,#06b6d4)' }}><LogIn size={20} /> Entrada</button>}
                  {sm!.state === 'working' && <>
                    <button onClick={() => act('out')} className="h-14 rounded-2xl bg-white text-black text-lg font-medium flex items-center justify-center gap-2"><LogOut size={20} /> Salida</button>
                    <button onClick={() => act('break_start')} className="h-12 rounded-2xl bg-white/10 font-medium flex items-center justify-center gap-2"><Coffee size={18} /> Pausa</button>
                  </>}
                  {sm!.state === 'break' && <button onClick={() => act('break_end')} className="h-14 rounded-2xl bg-amber-500 text-black text-lg font-medium flex items-center justify-center gap-2"><Play size={20} /> Volver de la pausa</button>}
                  <button onClick={() => setEmp(undefined)} className="h-10 text-sm text-white/50 hover:text-white">No soy yo</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
