import { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Mail, KeyRound, Building2, Ticket, ArrowRight, MapPin, LogOut } from 'lucide-react'
import logo from '../assets/aura.svg'
import { cloud, createCompany, joinWithCode, signOut, useDemo, loadAll } from '../lib/cloud'
import { uid } from '../lib/rng'
import { dayKey } from '../lib/time'
import { useStore } from '../store'
import { cx } from './ui'
import { publicBase } from '../lib/platform'
import type { Employee } from '../types'

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-full grid place-items-center px-4 py-10 aurora-bg">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cx('w-full', wide ? 'max-w-lg' : 'max-w-sm')}>
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <img src={logo} className="h-10 w-10" alt="" />
          <span className="text-2xl font-semibold tracking-tight">Aura</span>
        </div>
        <div className="card p-6 shadow-pop">{children}</div>
      </motion.div>
    </div>
  )
}

export function LoadingScreen() {
  return (
    <div className="min-h-full grid place-items-center">
      <div className="flex flex-col items-center gap-3 text-sm text-muted">
        <img src={logo} className="h-12 w-12 animate-pulse" alt="" />
        Cargando tu empresa…
      </div>
    </div>
  )
}

export function ErrorScreen() {
  const err = cloud((c) => c.error)
  return (
    <Shell>
      <div className="font-semibold">No se pudo conectar con el servidor</div>
      <p className="text-sm text-muted mt-1 break-words">{err}</p>
      <div className="flex gap-2 mt-5">
        <button className="btn-primary flex-1" onClick={() => loadAll()}>Reintentar</button>
        <button className="btn-outline" onClick={signOut}><LogOut size={14} /> Salir</button>
      </div>
    </Shell>
  )
}

export function AuthScreen() {
  const client = cloud((c) => c.client)!
  const invite = location.hash.match(/^#unirse-([A-Z0-9]+)$/i)?.[1]
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>(invite ? 'up' : 'in')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; ok?: boolean }>()
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(undefined)
    const redirect = publicBase() + location.hash
    const r =
      mode === 'in'
        ? await client.auth.signInWithPassword({ email, password: pass })
        : mode === 'up'
          ? await client.auth.signUp({ email, password: pass, options: { emailRedirectTo: redirect } })
          : await client.auth.resetPasswordForEmail(email, { redirectTo: redirect })
    setBusy(false)
    if (r.error) return setMsg({ t: r.error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : r.error.message })
    if (mode === 'up' && !('session' in r.data && r.data.session)) setMsg({ t: 'Te hemos enviado un email para confirmar tu cuenta. Ábrelo desde este dispositivo.', ok: true })
    if (mode === 'reset') setMsg({ t: 'Revisa tu email para crear una contraseña nueva.', ok: true })
  }
  return (
    <Shell>
      {invite && <div className="chip bg-brand/10 text-brand mb-3"><Ticket size={11} /> Te han invitado a unirte · código {invite}</div>}
      <h1 className="text-lg font-semibold">{mode === 'in' ? 'Inicia sesión' : mode === 'up' ? 'Crea tu cuenta' : 'Recuperar contraseña'}</h1>
      <p className="text-sm text-muted mb-5">{mode === 'up' ? 'Para tu empresa o para unirte a la de tu equipo.' : 'Fichaje, ausencias, documentos y nóminas.'}</p>
      <form onSubmit={submit} className="space-y-3">
        <div className="relative"><Mail size={15} className="absolute left-3 top-3 text-muted" /><input type="email" required autoComplete="email" className="input pl-9" placeholder="tu@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" /></div>
        {mode !== 'reset' && <div className="relative"><KeyRound size={15} className="absolute left-3 top-3 text-muted" /><input type="password" required minLength={8} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} className="input pl-9" placeholder="Contraseña (mín. 8)" value={pass} onChange={(e) => setPass(e.target.value)} aria-label="Contraseña" /></div>}
        {msg && <div className={cx('text-sm rounded-lg px-3 py-2', msg.ok ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad')}>{msg.t}</div>}
        <button className="btn-brand w-full h-10" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}{mode === 'in' ? 'Entrar' : mode === 'up' ? 'Crear cuenta' : 'Enviar enlace'}</button>
      </form>
      <div className="flex justify-between text-sm mt-4">
        {mode === 'in' ? <button className="text-brand font-medium" onClick={() => setMode('up')}>Crear cuenta</button> : <button className="text-brand font-medium" onClick={() => setMode('in')}>Ya tengo cuenta</button>}
        {mode === 'in' && <button className="text-muted hover:text-ink" onClick={() => setMode('reset')}>¿Olvidaste la contraseña?</button>}
      </div>
      <div className="border-t border-line mt-5 pt-4 text-center">
        <button className="text-sm text-muted hover:text-ink" onClick={() => useDemo(true)}>Ver la demostración sin cuenta →</button>
      </div>
    </Shell>
  )
}

export function Onboarding() {
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [f, setF] = useState({ company: '', legal: '', cif: '', name: '', role: 'Dirección', zoneName: 'Oficina central', lat: 0, lng: 0, start: '09:00', end: '18:00' })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [locating, setLocating] = useState(false)
  const email = cloud((c) => c.session?.user.email)
  const locate = () => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => { setF((x) => ({ ...x, lat: p.coords.latitude, lng: p.coords.longitude })); setLocating(false) },
      () => { setLocating(false); setErr('No se pudo obtener la ubicación; podrás situar el centro en Ajustes.') },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }
  const create = async () => {
    setBusy(true)
    setErr('')
    const empId = uid('e_')
    const zoneId = uid('z_')
    const emp: Employee = { id: empId, name: f.name, role: f.role, team: 'Dirección', zoneId, hue: Math.floor(Math.random() * 360), salary: 0, pagas: 14, contract: 'indefinido', weeklyHours: 40, start: f.start, end: f.end, breakMin: 60, remoteDays: [], pin: String(1000 + Math.floor(Math.random() * 9000)), birthday: '', hiredAt: dayKey(new Date()), children: 0, email }
    try {
      await createCompany(f.company, emp, { legal: f.legal || f.company, cif: f.cif })
      // El primer centro de trabajo se sincroniza como cualquier otro cambio
      useStore.getState().upsertZone({ id: zoneId, name: f.zoneName, address: '', lat: f.lat || 40.4168, lng: f.lng || -3.7038, radius: 150, color: '#6366f1' })
    } catch (e) {
      setErr((e as Error).message)
    }
    setBusy(false)
  }
  const join = async () => {
    setBusy(true)
    await joinWithCode(code)
    setBusy(false)
    if (cloud.getState().status === 'onboarding') setErr('Código no válido o caducado. Pídeselo de nuevo a tu responsable.')
  }
  return (
    <Shell wide>
      <div className="flex p-1 rounded-xl bg-sunken border border-line gap-1 mb-5">
        <button onClick={() => setTab('create')} className={cx('flex-1 h-9 rounded-lg text-sm font-medium flex items-center justify-center gap-2', tab === 'create' ? 'bg-surface shadow-card' : 'text-muted')}><Building2 size={15} /> Crear mi empresa</button>
        <button onClick={() => setTab('join')} className={cx('flex-1 h-9 rounded-lg text-sm font-medium flex items-center justify-center gap-2', tab === 'join' ? 'bg-surface shadow-card' : 'text-muted')}><Ticket size={15} /> Tengo un código</button>
      </div>
      {tab === 'create' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label" htmlFor="ob-c">Nombre de la empresa</label><input id="ob-c" className="input" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></div>
            <div><label className="label" htmlFor="ob-l">Razón social</label><input id="ob-l" className="input" placeholder="Opcional" value={f.legal} onChange={(e) => setF({ ...f, legal: e.target.value })} /></div>
            <div><label className="label" htmlFor="ob-cif">CIF</label><input id="ob-cif" className="input" placeholder="Opcional" value={f.cif} onChange={(e) => setF({ ...f, cif: e.target.value })} /></div>
            <div><label className="label" htmlFor="ob-n">Tu nombre</label><input id="ob-n" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><label className="label" htmlFor="ob-r">Tu puesto</label><input id="ob-r" className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></div>
            <div><label className="label" htmlFor="ob-z">Primer centro de trabajo</label><input id="ob-z" className="input" value={f.zoneName} onChange={(e) => setF({ ...f, zoneName: e.target.value })} /></div>
            <div className="flex items-end"><button type="button" onClick={locate} className={cx('btn-outline w-full', f.lat && 'text-ok')}>{locating ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />} {f.lat ? 'Ubicación guardada' : 'Estoy en el centro'}</button></div>
          </div>
          {err && <div className="text-sm text-bad">{err}</div>}
          <button className="btn-brand w-full h-10" disabled={busy || !f.company.trim() || !f.name.trim()} onClick={create}>{busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />} Crear empresa</button>
          <p className="text-xs text-muted">Serás administrador. Después podrás importar tu plantilla y tus documentos desde Factorial, Sesame, Excel… en Ajustes → Importar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">Pide a tu responsable el código de invitación de 8 caracteres o abre el enlace que te ha enviado.</p>
          <input className="input font-mono text-lg tracking-widest uppercase text-center h-12" placeholder="ABCD1234" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Código" />
          {err && <div className="text-sm text-bad">{err}</div>}
          <button className="btn-brand w-full h-10" disabled={busy || code.trim().length < 6} onClick={join}>{busy && <Loader2 size={15} className="animate-spin" />} Unirme</button>
        </div>
      )}
      <div className="text-xs text-muted text-center mt-5">Sesión iniciada como {email} · <button className="underline" onClick={signOut}>cerrar sesión</button></div>
    </Shell>
  )
}
