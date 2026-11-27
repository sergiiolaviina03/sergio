import { AnimatePresence, motion } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import { create } from 'zustand'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import type { Employee } from '../types'

export const cx = clsx

export function Avatar({ emp, size = 32, ring }: { emp: Pick<Employee, 'name' | 'hue'>; size?: number; ring?: 'ok' | 'warn' | 'muted' | 'brand' }) {
  const ini = emp.name.split(' ').map((p) => p[0]).slice(0, 2).join('')
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full grid place-items-center font-semibold text-white select-none"
        style={{ fontSize: size * 0.36, background: `linear-gradient(135deg, hsl(${emp.hue} 75% 62%), hsl(${(emp.hue + 40) % 360} 70% 50%))` }}
      >
        {ini}
      </div>
      {ring && (
        <span
          className={cx('absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-surface', ring === 'ok' && 'bg-ok', ring === 'warn' && 'bg-warn', ring === 'muted' && 'bg-muted/50', ring === 'brand' && 'bg-brand')}
          style={{ width: size * 0.32, height: size * 0.32 }}
        />
      )}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide, icon }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; icon?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            className={cx('relative card shadow-pop w-full max-h-[90vh] overflow-auto', wide ? 'max-w-3xl' : 'max-w-md')}
            initial={{ y: 16, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 10, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            {title && (
              <div className="flex items-center gap-2.5 px-5 pt-5">
                {icon}
                <h3 className="font-semibold text-[15px] flex-1">{title}</h3>
                <button className="btn-ghost h-8 w-8 px-0" onClick={onClose} aria-label="Cerrar">
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type Toast = { id: number; title: string; body?: string; tone?: 'ok' | 'warn' | 'bad' | 'ai'; action?: { label: string; run: () => void } }
export const useToasts = create<{ items: Toast[]; push: (t: Omit<Toast, 'id'>) => void; drop: (id: number) => void }>((set, get) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random()
    set({ items: [...get().items, { ...t, id }].slice(-4) })
    setTimeout(() => get().drop(id), t.action ? 7000 : 4200)
  },
  drop: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
}))
export const toast = (t: Omit<Toast, 'id'>) => useToasts.getState().push(t)

export function Toaster() {
  const { items, drop } = useToasts()
  return (
    <div className="fixed z-[60] bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30 }}
            className={cx('pointer-events-auto card shadow-pop px-4 py-3 w-full sm:w-[360px] flex gap-3 items-start', t.tone === 'ai' && 'aurora-border')}
          >
            <span className={cx('mt-1 h-2 w-2 rounded-full shrink-0', t.tone === 'warn' ? 'bg-warn' : t.tone === 'bad' ? 'bg-bad' : t.tone === 'ai' ? 'bg-brand' : 'bg-ok')} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium flex items-center gap-1.5">
                {t.tone === 'ai' && <Sparkles size={13} className="text-brand" />}
                {t.title}
              </div>
              {t.body && <div className="text-xs text-muted mt-0.5">{t.body}</div>}
            </div>
            {t.action && (
              <button
                className="text-xs font-semibold text-brand hover:underline shrink-0"
                onClick={() => {
                  t.action!.run()
                  drop(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function Section({ title, action, children, className, icon }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <section className={cx('card p-5', className)}>
      {(title || action) && (
        <div className="flex items-center gap-2 mb-4">
          {icon && <span className="text-muted">{icon}</span>}
          <h2 className="text-sm font-semibold flex-1">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ icon, title, subtitle, actions, tabs }: { icon: ReactNode; title: string; subtitle?: ReactNode; actions?: ReactNode; tabs?: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-10 rounded-xl grid place-items-center bg-surface border border-line shadow-card text-brand">{icon}</div>
        <div className="flex-1 min-w-[180px]">
          <h1 className="h-title leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      {tabs && <div className="mt-5">{tabs}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-sunken border border-line gap-1">
      {items.map((it) => (
        <button key={it.id} onClick={() => onChange(it.id)} className={cx('relative h-8 px-3 rounded-lg text-sm font-medium transition', value === it.id ? 'text-ink' : 'text-muted hover:text-ink')}>
          {value === it.id && <motion.span layoutId={`tab-${items.map((i) => i.id).join()}`} className="absolute inset-0 bg-surface rounded-lg shadow-card border border-line" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative">{it.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-2">
      <span className="flex-1">
        <span className="text-sm font-medium block">{label}</span>
        {hint && <span className="text-xs text-muted block mt-0.5">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cx('mt-0.5 relative h-6 w-10 rounded-full transition shrink-0', on ? 'bg-brand' : 'bg-line')}>
        <motion.span layout className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ left: on ? 18 : 2 }} transition={{ type: 'spring', stiffness: 600, damping: 35 }} />
      </button>
    </label>
  )
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'brand' }) {
  return (
    <div>
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={cx('kpi', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn', tone === 'bad' && 'text-bad', tone === 'brand' && 'text-brand')}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  )
}

export function Empty({ icon, title, body }: { icon: ReactNode; title: string; body?: string }) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-sunken grid place-items-center text-muted mb-3">{icon}</div>
      <div className="text-sm font-medium">{title}</div>
      {body && <div className="text-xs text-muted mt-1 max-w-xs mx-auto">{body}</div>}
    </div>
  )
}

export function AiNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('aurora-border rounded-xl bg-surface px-3.5 py-2.5 text-sm flex gap-2.5 items-start', className)}>
      <Sparkles size={15} className="text-brand mt-0.5 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  )
}
