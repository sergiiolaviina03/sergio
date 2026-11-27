import { Settings, MapPin, Plus, Trash2, RotateCcw, Radar, ShieldCheck, Palette, Server, LogOut, Upload, ArrowRight, Download } from 'lucide-react'
import { saveFile } from '../lib/platform'
import { dayKey } from '../lib/time'
import { cloud, saveServerConfig, serverConfig, signOut, useDemo, demoForced } from '../lib/cloud'
import { go } from '../lib/nav'
import { useState } from 'react'
import { useStore } from '../store'
import { MapView } from '../components/MapView'
import { PageHeader, Section, Toggle, Tabs, cx, toast, Modal } from '../components/ui'
import { uid } from '../lib/rng'
import type { Zone } from '../types'

const COLORS = ['#6366f1', '#06b6d4', '#a855f7', '#10b981', '#f59e0b', '#ec4899']

export function SettingsPage() {
  const s = useStore()
  const [sel, setSel] = useState<string | undefined>(s.zones[0]?.id)
  const [adding, setAdding] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const zone = s.zones.find((z) => z.id === sel)
  const manager = s.settings.viewAs === 'manager'

  const onMap = (lat: number, lng: number) => {
    if (!manager) return
    if (adding) {
      const z: Zone = { id: uid('z_'), name: `Nuevo centro ${s.zones.length + 1}`, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng, radius: 120, color: COLORS[s.zones.length % COLORS.length] }
      s.upsertZone(z)
      setSel(z.id)
      setAdding(false)
      toast({ title: 'Centro creado', body: 'Ajusta su nombre y radio.' })
    } else if (zone) s.upsertZone({ ...zone, lat, lng })
  }

  return (
    <div>
      <PageHeader icon={<Settings size={19} />} title="Ajustes" subtitle="Centros de trabajo, políticas de fichaje y preferencias" />
      <div className="grid xl:grid-cols-[1fr_380px] gap-5">
        <Section title="Centros y geovallas" icon={<MapPin size={15} />} action={manager && <button className={cx('btn h-8', adding ? 'bg-brand text-white' : 'btn-outline')} onClick={() => setAdding(!adding)}><Plus size={14} /> {adding ? 'Haz clic en el mapa…' : 'Añadir centro'}</button>}>
          <div className="h-[380px] rounded-xl overflow-hidden border border-line">
            <MapView zones={s.zones} onClick={onMap} fit={zone ? [[zone.lat, zone.lng]] : undefined} zoom={zone ? 16 : 6} pins={zone ? [{ id: 'c', lat: zone.lat, lng: zone.lng, color: zone.color }] : []} />
          </div>
          <p className="text-xs text-muted mt-2">{manager ? 'Haz clic en el mapa para mover el centro seleccionado.' : 'Solo un responsable puede editar los centros.'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {s.zones.map((z) => (
              <button key={z.id} onClick={() => setSel(z.id)} className={cx('chip h-8 px-3 border text-xs', sel === z.id ? 'border-brand bg-brand/10 text-ink' : 'border-line bg-surface text-muted')}>
                <span className="h-2 w-2 rounded-full" style={{ background: z.color }} /> {z.name}
              </button>
            ))}
          </div>
          {zone && manager && (
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 mt-4 items-end">
              <div><label className="label">Nombre</label><input className="input" value={zone.name} onChange={(e) => s.upsertZone({ ...zone, name: e.target.value })} /></div>
              <div>
                <label className="label">Radio de la geovalla · {zone.radius} m</label>
                <input type="range" min={30} max={1000} step={10} value={zone.radius} onChange={(e) => s.upsertZone({ ...zone, radius: +e.target.value })} className="w-full accent-[rgb(var(--brand))] h-10" />
              </div>
              <button className="btn-outline text-bad" onClick={() => { s.removeZone(zone.id); setSel(s.zones.find((z) => z.id !== zone.id)?.id) }} aria-label="Eliminar"><Trash2 size={15} /></button>
            </div>
          )}
        </Section>

        <div className="space-y-5">
          <Section title="Ubicación" icon={<Radar size={15} />}>
            <Tabs value={s.settings.locationMode} onChange={(v) => s.setSettings({ locationMode: v })} items={[{ id: 'demo', label: 'Simulada (demo)' }, { id: 'real', label: 'GPS real' }]} />
            {s.settings.locationMode === 'demo' ? (
              <div className="mt-4">
                <label className="label">Simular que estoy en…</label>
                <select className="input" value={s.settings.demoSpot} onChange={(e) => s.setSettings({ demoSpot: e.target.value })}>
                  {s.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                  <option value="remote">Casa (teletrabajo)</option>
                  <option value="far">Una cafetería a 1 km (fuera de zona)</option>
                </select>
                <p className="text-xs text-muted mt-2">Útil para probar la app desde cualquier sitio.</p>
              </div>
            ) : (
              <p className="text-xs text-muted mt-3">Usa el GPS de tu dispositivo: el navegador pide permiso la primera vez que fichas. Si no hay señal, el fichaje se guarda marcado «sin ubicación» para revisión, o puedes fichar escaneando el QR del quiosco.</p>
            )}
          </Section>
          <Section title="Políticas de fichaje" icon={<ShieldCheck size={15} />}>
            <Toggle on={s.settings.strictGeofence} onChange={(v) => s.setSettings({ strictGeofence: v })} label="Geovalla estricta" hint="Bloquea fichajes fuera de un centro salvo teletrabajo previsto. Si está desactivada, se permiten y se marcan para revisión." />
            <Toggle on={s.settings.requireSelfie} onChange={(v) => s.setSettings({ requireSelfie: v })} label="Selfie al fichar" hint="Evita fichajes por otra persona. La foto se guarda en miniatura y su huella entra en el sello." />
            <Toggle on={s.settings.arrivalReminder} onChange={(v) => { s.setSettings({ arrivalReminder: v }); if (v && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission() }} label="Aviso al llegar a la oficina" hint="Con la app abierta o instalada, te propone fichar al entrar en la geovalla de tu centro a tu hora de entrada." />
            <Toggle on={s.settings.autoBreakReminder} onChange={(v) => s.setSettings({ autoBreakReminder: v })} label="Recordatorio de pausa" hint="Avisa antes de superar 6 h seguidas sin descanso (art. 34.4 ET)." />
          </Section>
          <Section title="Apariencia" icon={<Palette size={15} />}>
            <Tabs value={s.settings.theme} onChange={(v) => s.setSettings({ theme: v })} items={[{ id: 'light', label: 'Claro' }, { id: 'dark', label: 'Oscuro' }, { id: 'system', label: 'Sistema' }]} />
          </Section>
          <ServerSection />
          {manager && (
            <button onClick={() => go('import')} className="card p-5 w-full text-left flex items-center gap-3 hover:shadow-pop transition">
              <span className="h-10 w-10 rounded-xl bg-brand/10 text-brand grid place-items-center"><Upload size={18} /></span>
              <div className="flex-1"><div className="font-medium">Importar desde otro sistema</div><div className="text-xs text-muted">Factorial, Sesame, Woffu, A3, Excel o copia de Aura: plantilla, fichajes, ausencias y documentos.</div></div>
              <ArrowRight size={16} className="text-muted" />
            </button>
          )}
          {manager && (
            <button onClick={() => {
              const st = useStore.getState()
              const { employees, zones, requests, corrections, periods, documents, expenses, shifts, punches, company } = st
              saveFile(`aura-copia-${dayKey(new Date())}.json`, JSON.stringify({ app: 'aura', version: 1, exportedAt: new Date().toISOString(), company, employees, zones, requests, corrections, periods, documents, expenses, shifts, punches }), 'application/json')
              toast({ title: 'Copia completa exportada', body: 'Sirve para migrar a otra instalación de Aura o como respaldo.' })
            }} className="btn-outline w-full"><Download size={15} /> Exportar copia completa</button>
          )}
          {cloud.getState().status !== 'ready' && <Section title="Datos de demostración">
            <p className="text-xs text-muted mb-3">Todo se guarda en este navegador. Puedes volver al estado inicial cuando quieras.</p>
            <button className="btn-outline w-full" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reiniciar demo</button>
          </Section>}
        </div>
      </div>
      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="¿Reiniciar la demo?">
        <p className="text-sm text-muted">Se borrarán tus fichajes, solicitudes y ajustes de este navegador y se generarán datos nuevos.</p>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={() => setConfirmReset(false)}>Cancelar</button>
          <button className="btn-primary" onClick={() => { s.reset(); setConfirmReset(false); toast({ title: 'Demo reiniciada' }) }}>Reiniciar</button>
        </div>
      </Modal>
    </div>
  )
}

function ServerSection() {
  const c = cloud()
  const cfg = serverConfig()
  const [url, setUrl] = useState(cfg?.url ?? '')
  const [key, setKey] = useState('')
  return (
    <Section title="Servidor" icon={<Server size={15} />}>
      {c.status === 'ready' ? (
        <>
          <div className="text-sm"><span className="chip bg-ok/10 text-ok mr-1.5">Conectado</span>{c.session?.user.email}</div>
          <div className="text-xs text-muted mt-2">Rol: {c.role === 'admin' ? 'administrador' : c.role === 'manager' ? 'responsable' : 'empleado'} · {c.members.length} cuentas activas · {new URL(cfg!.url).host}</div>
          <button className="btn-outline w-full mt-4" onClick={signOut}><LogOut size={15} /> Cerrar sesión</button>
        </>
      ) : demoForced() && cfg ? (
        <>
          <p className="text-sm text-muted">Estás viendo la demostración. Tu empresa está en {new URL(cfg.url).host}.</p>
          <button className="btn-brand w-full mt-3" onClick={() => useDemo(false)}>Volver a mi empresa</button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted mb-3">Conecta un servidor Supabase (gratuito para empezar, o autoalojado) para tener cuentas, varias personas y datos compartidos entre dispositivos. Las instrucciones están en <code className="text-xs">supabase/README.md</code>.</p>
          <label className="label" htmlFor="srv-url">URL del proyecto</label>
          <input id="srv-url" className="input" placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
          <label className="label mt-3" htmlFor="srv-key">Clave pública (anon)</label>
          <input id="srv-key" className="input font-mono text-xs" placeholder="eyJhbGciOi…" value={key} onChange={(e) => setKey(e.target.value)} />
          <button className="btn-brand w-full mt-3" disabled={!/^https:\/\//.test(url) || key.length < 20} onClick={() => saveServerConfig(url, key)}>Conectar</button>
          {cfg && !cfg.fromEnv && <button className="btn-ghost w-full mt-1 text-xs" onClick={() => saveServerConfig('', null)}>Desconectar servidor guardado</button>}
        </>
      )}
    </Section>
  )
}
