import { ShieldCheck, ShieldAlert, Download, Link2, FlaskConical, RotateCcw, Loader2, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import { verify, short, type VerifyResult } from '../lib/ledger'
import { fmt } from '../lib/time'
import { AiNote, Avatar, PageHeader, Section, Tabs, cx, toast } from '../components/ui'
import { LABEL } from '../components/ClockFlow'
import { COMPANY } from '../data/seed'
import { sha256 } from '../lib/sha256'

export function LedgerPage() {
  const s = useStore()
  const manager = s.settings.viewAs === 'manager'
  const [scope, setScope] = useState<'me' | 'all'>(manager ? 'all' : 'me')
  const [res, setRes] = useState<VerifyResult>()
  const [busy, setBusy] = useState(false)
  const chain = s.punches
  const rows = useMemo(() => (scope === 'me' ? chain.filter((p) => p.empId === s.meId) : chain).slice(-60).reverse(), [chain, scope, s.meId])
  const head = chain.at(-1)
  const emp = (id: string) => s.employees.find((e) => e.id === id)!

  const run = async () => {
    setBusy(true)
    setRes(undefined)
    await new Promise((r) => setTimeout(r, 700))
    const r = verify(chain)
    setRes(r)
    setBusy(false)
  }

  const exportJson = () => {
    const data = scope === 'me' ? chain.filter((p) => p.empId === s.meId) : chain
    const body = { empresa: COMPANY.legal, cif: COMPANY.cif, generado: new Date().toISOString(), algoritmo: 'SHA-256 encadenado (seq|empleado|tipo|ts|lat|lng|precisión|zona|remoto|método|flags|nota|selfie|hashAnterior)', cabeza: head?.hash, registros: data.map(({ selfie, ...p }) => ({ ...p, selfieHash: selfie ? sha256(selfie) : undefined, empleado: emp(p.empId).name, fecha: new Date(p.ts).toISOString() })) }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }))
    a.download = `registro-jornada-sellado-${fmt(Date.now(), 'yyyyMMdd-HHmm')}.json`
    a.click()
    toast({ title: 'Paquete para Inspección exportado', body: `${data.length} registros con su cadena de sellos.` })
  }

  return (
    <div>
      <PageHeader
        icon={<ShieldCheck size={19} />}
        title="Registro sellado"
        subtitle="Cada fichaje queda encadenado criptográficamente: nadie puede alterarlo sin que se note"
        actions={
          <>
            <button className="btn-outline" onClick={exportJson}><Download size={15} /> Exportar para Inspección</button>
            <button className="btn-brand" onClick={run} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Verificar integridad</button>
          </>
        }
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <div className="card p-4"><div className="text-xs text-muted">Registros sellados</div><div className="kpi mt-1">{chain.length.toLocaleString('es-ES')}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">Sello de cabeza</div><div className="font-mono text-sm mt-2 truncate">{head?.hash}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">Último asiento</div><div className="kpi mt-1 text-xl">#{head?.seq} · {head && fmt(head.ts, 'd MMM HH:mm')}</div></div>
      </div>

      <AnimatePresence>
        {(res || busy) && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cx('card p-5 mb-5 flex items-center gap-4', res && !res.ok && 'border-bad/40 bg-bad/5', res?.ok && 'border-ok/40 bg-ok/5')}>
            <div className={cx('h-12 w-12 rounded-2xl grid place-items-center shrink-0', busy ? 'bg-brand/10 text-brand' : res?.ok ? 'bg-ok text-white' : 'bg-bad text-white')}>
              {busy ? <Loader2 className="animate-spin" /> : res?.ok ? <ShieldCheck /> : <ShieldAlert />}
            </div>
            <div className="flex-1">
              {busy ? (
                <>
                  <div className="font-medium">Recalculando {chain.length.toLocaleString('es-ES')} sellos…</div>
                  <div className="h-1.5 rounded-full bg-sunken mt-2 overflow-hidden"><motion.div className="h-full bg-brand" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 0.7 }} /></div>
                </>
              ) : res?.ok ? (
                <>
                  <div className="font-medium">Registro íntegro</div>
                  <div className="text-sm text-muted">{res.checked.toLocaleString('es-ES')} registros verificados en {res.ms.toFixed(0)} ms. Ninguna entrada, salida o pausa ha sido modificada desde que se selló.</div>
                </>
              ) : (
                <>
                  <div className="font-medium text-bad">Manipulación detectada en el asiento #{res?.brokenAt}</div>
                  <div className="text-sm text-muted">{res?.reason}. Los {res?.checked.toLocaleString('es-ES')} registros anteriores son válidos; a partir de aquí la cadena no cuadra.</div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid xl:grid-cols-[1fr_340px] gap-5">
        <section className="card overflow-hidden min-w-0">
          <div className="flex items-center gap-3 p-4 border-b border-line">
            <Tabs value={scope} onChange={setScope} items={[{ id: 'me', label: 'Mis registros' }, ...(manager ? [{ id: 'all' as const, label: 'Toda la empresa' }] : [])]} />
            <span className="text-xs text-muted ml-auto">últimos 60</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-xs text-muted text-left border-b border-line bg-sunken/50">
                  <th className="font-medium px-4 h-9">#</th><th className="font-medium">Persona</th><th className="font-medium">Evento</th><th className="font-medium">Lugar</th><th className="font-medium">Sello anterior</th><th className="font-medium pr-4">Sello</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const broken = s.tampered?.id === p.id
                  return (
                    <tr key={p.id} className={cx('border-b border-line last:border-0', broken && res && !res.ok && 'bg-bad/10')}>
                      <td className="px-4 py-2 font-mono text-xs text-muted">{p.seq}</td>
                      <td><div className="flex items-center gap-2"><Avatar emp={emp(p.empId)} size={22} /><span className="truncate max-w-[120px]">{emp(p.empId).name.split(' ')[0]}</span></div></td>
                      <td className="whitespace-nowrap">{LABEL[p.type]} <span className="text-muted tabular-nums">{fmt(p.ts, 'd MMM HH:mm:ss')}</span>{p.method === 'correction' && <span className="chip bg-brand/10 text-brand ml-1.5">corrección</span>}</td>
                      <td className="text-muted whitespace-nowrap">{p.zoneId ? s.zones.find((z) => z.id === p.zoneId)?.name.split(' · ')[0] : p.remote ? 'Remoto' : p.lat != null ? 'Fuera de zona' : '—'}</td>
                      <td className="font-mono text-xs text-muted">{short(p.prevHash)}</td>
                      <td className="font-mono text-xs pr-4"><span className="inline-flex items-center gap-1"><Lock size={10} className="text-ok" />{short(p.hash)}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-5">
          <Section title="Así funciona" icon={<Link2 size={15} />}>
            <div className="space-y-2">
              {chain.slice(-3).map((p, i) => (
                <div key={p.id}>
                  <div className="rounded-xl border border-line bg-sunken/60 p-3 font-mono text-[11px] leading-relaxed">
                    <div className="text-muted">#{p.seq} · {LABEL[p.type]} · {fmt(p.ts, 'HH:mm')}</div>
                    <div><span className="text-muted">prev </span>{short(p.prevHash)}</div>
                    <div><span className="text-muted">hash </span><span className="text-brand">{short(p.hash)}</span></div>
                  </div>
                  {i < 2 && <div className="h-4 w-px bg-brand/50 mx-auto" />}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-3">Cada sello SHA-256 incluye el sello del registro anterior. Cambiar un solo segundo en cualquier fichaje rompe todos los sellos posteriores. Las correcciones nunca borran: se añaden como asientos nuevos, aprobados y trazables.</p>
          </Section>
          <Section title="Pruébalo tú" icon={<FlaskConical size={15} />}>
            <p className="text-sm text-muted mb-3">Simula que alguien edita a escondidas una de tus salidas para regalarse 47 minutos, y verifica.</p>
            {s.tampered ? (
              <button className="btn-outline w-full" onClick={() => { s.untamper(); setRes(undefined) }}><RotateCcw size={15} /> Restaurar registro original</button>
            ) : (
              <button className="btn-outline w-full text-bad" onClick={() => { s.tamper(); setRes(undefined); toast({ title: 'Registro manipulado (simulación)', body: 'Ahora pulsa «Verificar integridad».', tone: 'warn' }) }}><FlaskConical size={15} /> Manipular un fichaje</button>
            )}
          </Section>
          <AiNote>Pensado para el registro de jornada digital: inalterable, trazable, exportable y accesible a distancia para la Inspección de Trabajo.</AiNote>
        </div>
      </div>
    </div>
  )
}
