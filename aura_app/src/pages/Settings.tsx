import { Settings, MapPin, Plus, Trash2, RotateCcw, Radar, ShieldCheck, Palette } from 'lucide-react'
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
          <Section title="Datos de demostración">
            <p className="text-xs text-muted mb-3">Todo se guarda en este navegador. Puedes volver al estado inicial cuando quieras.</p>
            <button className="btn-outline w-full" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reiniciar demo</button>
          </Section>
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
