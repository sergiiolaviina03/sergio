import logo from '../assets/aura.svg'
import { FileSignature, Receipt, Users2, CalendarRange, Home, Timer, CalendarDays, Wallet, Users, Inbox, ShieldCheck, Settings, Sparkles, Table2, MonitorSmartphone, Moon, Sun, Menu, Bell } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNav } from '../lib/nav'
import type { Page } from '../lib/copilot'
import { useMe, useStore } from '../store'
import { Avatar, cx } from './ui'
import { useDark, useToday } from '../lib/hooks'
import { clock, fmt } from '../lib/time'
import { usePendingDocs } from '../pages/Documents'

type Item = { id: Page; label: string; icon: ReactNode; badge?: number; manager?: boolean; alert?: boolean }

export function useInboxCount() {
  const s = useStore()
  if (s.settings.viewAs !== 'manager') return 0
  const team = new Set(s.employees.filter((e) => e.managerId === s.meId).map((e) => e.id))
  return s.requests.filter((r) => r.status === 'pending' && team.has(r.empId)).length + s.expenses.filter((x) => x.status === 'pending' && team.has(x.empId)).length + s.corrections.filter((c) => c.status === 'pending' && team.has(c.empId)).length + s.periods.filter((p) => p.status === 'submitted' && team.has(p.empId)).length
}

export function Layout({ children }: { children: ReactNode }) {
  const { page, go, setCopilot } = useNav()
  const me = useMe()
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const notices = useStore((s) => s.notices)
  const companyName = useStore((s) => s.company.name)
  const inbox = useInboxCount()
  const pendingDocs = usePendingDocs().length
  const dark = useDark()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [bell, setBell] = useState(false)
  const unread = notices.filter((n) => !n.read).length
  const manager = settings.viewAs === 'manager'

  const groups: { title?: string; items: Item[] }[] = [
    { items: [{ id: 'home', label: 'Inicio', icon: <Home size={17} /> }, { id: 'inbox', label: 'Bandeja', icon: <Inbox size={17} />, badge: inbox, manager: true }] },
    { title: 'Personal', items: [{ id: 'clock', label: 'Mi jornada', icon: <Timer size={17} /> }, { id: 'timesheet', label: 'Hoja de horas', icon: <Table2 size={17} /> }, { id: 'timeoff', label: 'Ausencias', icon: <CalendarDays size={17} /> }, { id: 'payroll', label: 'Nóminas', icon: <Wallet size={17} /> }, { id: 'documents', label: 'Documentos', icon: <FileSignature size={17} />, badge: pendingDocs, alert: true }, { id: 'expenses', label: 'Gastos', icon: <Receipt size={17} /> }] },
    { title: 'Empresa', items: [{ id: 'team', label: 'Equipo en vivo', icon: <Users size={17} />, manager: true }, { id: 'people', label: 'Personas', icon: <Users2 size={17} />, manager: true }, { id: 'shifts', label: 'Turnos', icon: <CalendarRange size={17} />, manager: true }, { id: 'ledger', label: 'Registro sellado', icon: <ShieldCheck size={17} /> }] },
    { title: 'Más', items: [{ id: 'kiosk', label: 'Modo quiosco', icon: <MonitorSmartphone size={17} />, manager: true }, { id: 'settings', label: 'Ajustes', icon: <Settings size={17} /> }] },
  ]

  const nav = (
    <nav className="flex flex-col gap-5">
      {groups.map((g, i) => {
        const items = g.items.filter((it) => !it.manager || manager)
        if (!items.length) return null
        return (
          <div key={i}>
            {g.title && <div className="px-3 mb-1.5 text-[11px] font-medium text-muted uppercase tracking-wider">{g.title}</div>}
            <div className="flex flex-col gap-0.5">
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => {
                    go(it.id)
                    setMobileMenu(false)
                  }}
                  className={cx('relative flex items-center gap-3 h-9 px-3 rounded-xl text-sm transition', page === it.id ? 'text-ink font-medium' : 'text-muted hover:text-ink hover:bg-sunken')}
                >
                  {page === it.id && <motion.span layoutId="navpill" className="absolute inset-0 rounded-xl bg-surface border border-line shadow-card" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                  <span className={cx('relative', page === it.id && 'text-brand')}>{it.icon}</span>
                  <span className="relative flex-1 text-left">{it.label}</span>
                  {!!it.badge && <span className={cx('relative chip text-white min-w-[20px] justify-center', it.alert ? 'bg-bad' : 'bg-brand')}>{it.badge}</span>}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )

  if (page === 'kiosk') return <>{children}</>

  return (
    <div className="min-h-full flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-[248px] shrink-0 flex-col gap-5 px-3 py-4 border-r border-line bg-bg sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-2">
          <img src={logo} className="h-8 w-8" alt="" />
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">Aura</div>
            <div className="text-[11px] text-muted">{companyName}</div>
          </div>
          <button onClick={() => setBell(!bell)} className="ml-auto relative h-8 w-8 rounded-lg hover:bg-sunken grid place-items-center text-muted" aria-label="Notificaciones">
            <Bell size={16} />
            {!!unread && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand" />}
          </button>
        </div>
        <button onClick={() => setCopilot(true)} className="aurora-border mx-1 flex items-center gap-2 h-10 px-3 rounded-xl bg-surface text-sm text-muted hover:text-ink transition shadow-card">
          <Sparkles size={15} className="text-brand" />
          <span className="flex-1 text-left truncate">Pregunta a Aura…</span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-sunken border border-line">Ctrl K</kbd>
        </button>
        <div className="flex-1 overflow-auto -mx-1 px-1">{nav}</div>
        <MiniStatus />
        <div className="flex items-center gap-2.5 px-2">
          <Avatar emp={me} size={32} />
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-sm font-medium truncate">{me.name}</div>
            <button onClick={() => setSettings({ viewAs: manager ? 'employee' : 'manager' })} className="text-[11px] text-muted hover:text-brand">
              Vista {manager ? 'responsable' : 'empleado'} · cambiar
            </button>
          </div>
          <button onClick={() => setSettings({ theme: dark ? 'light' : 'dark' })} className="h-8 w-8 rounded-lg hover:bg-sunken grid place-items-center text-muted" aria-label="Cambiar tema">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 px-4 flex items-center gap-3 bg-bg/85 backdrop-blur border-b border-line">
        <img src={logo} className="h-7 w-7" alt="" />
        <span className="font-semibold">Aura</span>
        <button onClick={() => setBell(!bell)} className="ml-auto relative h-9 w-9 rounded-lg grid place-items-center" aria-label="Notificaciones">
          <Bell size={18} />
          {!!unread && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-brand" />}
        </button>
        <button onClick={() => setMobileMenu(true)} className="h-9 w-9 rounded-lg grid place-items-center" aria-label="Menú">
          <Menu size={20} />
        </button>
      </div>
      <AnimatePresence>
        {mobileMenu && (
          <motion.div className="lg:hidden fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileMenu(false)} />
            <motion.div className="absolute right-0 top-0 bottom-0 w-[280px] bg-bg border-l border-line p-4 overflow-auto" initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }} transition={{ type: 'spring', stiffness: 400, damping: 40 }}>
              <div className="flex items-center gap-2.5 mb-5">
                <Avatar emp={me} size={36} />
                <div className="flex-1 leading-tight">
                  <div className="text-sm font-medium">{me.name}</div>
                  <button onClick={() => setSettings({ viewAs: manager ? 'employee' : 'manager' })} className="text-[11px] text-muted">Vista {manager ? 'responsable' : 'empleado'} · cambiar</button>
                </div>
                <button onClick={() => setSettings({ theme: dark ? 'light' : 'dark' })} className="h-9 w-9 rounded-lg grid place-items-center" aria-label="Tema">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
              </div>
              {nav}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Notifications open={bell} onClose={() => setBell(false)} />

      <main className="flex-1 min-w-0 aurora-bg">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-20 lg:pt-8 pb-28 lg:pb-12">
          <motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {children}
          </motion.div>
        </div>
      </main>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-16 items-center">
          {(
            [
              ['home', 'Inicio', <Home size={20} key="h" />],
              ['clock', 'Jornada', <Timer size={20} key="t" />],
              null,
              ['timeoff', 'Ausencias', <CalendarDays size={20} key="c" />],
              ['payroll', 'Nómina', <Wallet size={20} key="w" />],
            ] as const
          ).map((it, i) =>
            it ? (
              <button key={it[0]} onClick={() => go(it[0])} className={cx('flex flex-col items-center gap-0.5 text-[10px]', page === it[0] ? 'text-brand' : 'text-muted')}>
                {it[2]}
                {it[1]}
              </button>
            ) : (
              <div key={i} className="grid place-items-center">
                <button onClick={() => setCopilot(true)} className="-mt-7 h-14 w-14 rounded-full text-white grid place-items-center shadow-glow" style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1 55%,#22d3ee)' }} aria-label="Copiloto">
                  <Sparkles size={22} />
                </button>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

function MiniStatus() {
  const me = useMe()
  const t = useToday(me.id)
  const go = useNav((s) => s.go)
  if (t.state === 'none') return null
  const c = t.state === 'working' ? 'bg-brand' : t.state === 'break' ? 'bg-warn' : 'bg-ok'
  return (
    <button onClick={() => go('clock')} className="mx-1 card px-3 py-2.5 flex items-center gap-2.5 text-left hover:shadow-pop transition">
      <span className="relative flex h-2.5 w-2.5">
        {t.state !== 'done' && <span className={cx('absolute inset-0 rounded-full animate-ping2', c)} />}
        <span className={cx('relative h-2.5 w-2.5 rounded-full', c)} />
      </span>
      <div className="flex-1 leading-tight">
        <div className="text-[11px] text-muted">{t.state === 'working' ? 'Trabajando' : t.state === 'break' ? 'En pausa' : 'Jornada cerrada'}</div>
        <div className="text-sm font-semibold tabular-nums">{clock(t.worked * 60000)}</div>
      </div>
    </button>
  )
}

function Notifications({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notices = useStore((s) => s.notices)
  const readAll = useStore((s) => s.readAll)
  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { readAll(); onClose() }} />
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="fixed z-50 top-14 right-3 lg:left-[200px] lg:top-4 lg:right-auto w-[340px] max-w-[calc(100vw-24px)] card shadow-pop p-2 max-h-[70vh] overflow-auto">
            <div className="px-2 py-1.5 text-sm font-semibold flex items-center">
              Notificaciones
              <button onClick={readAll} className="ml-auto text-xs text-brand font-medium">Marcar leídas</button>
            </div>
            {notices.map((n) => (
              <div key={n.id} className="px-2 py-2 rounded-lg hover:bg-sunken flex gap-2.5">
                <span className={cx('mt-1.5 h-2 w-2 rounded-full shrink-0', n.read ? 'bg-line' : 'bg-brand')} />
                <div className="flex-1">
                  <div className="text-sm">{n.title}</div>
                  {n.body && <div className="text-xs text-muted">{n.body}</div>}
                  <div className="text-[11px] text-muted mt-0.5">{fmt(n.ts, "d MMM · HH:mm")}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
