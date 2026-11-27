import { Receipt, Upload, Sparkles, Loader2, Car, Trash2, Download, ScanLine, AlertTriangle } from 'lucide-react'
import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMe, useStore } from '../store'
import type { Expense } from '../types'
import { AiNote, Empty, Modal, PageHeader, Stat, Tabs, cx, toast } from '../components/ui'
import { eur } from '../lib/payroll'
import { dayKey, fmt, monthKey, parseDay, isoDow } from '../lib/time'
import { readReceipt, type ReceiptData } from '../lib/ocr'
import { saveFile } from '../lib/platform'

export const CATS: Record<Expense['category'], { label: string; emoji: string; limit?: number }> = {
  comida: { label: 'Comida', emoji: '🍽️', limit: 40 },
  transporte: { label: 'Transporte', emoji: '🚆' },
  alojamiento: { label: 'Alojamiento', emoji: '🏨', limit: 160 },
  material: { label: 'Material', emoji: '🖊️' },
  software: { label: 'Software', emoji: '💻' },
  kilometraje: { label: 'Kilometraje', emoji: '🚗' },
  otros: { label: 'Otros', emoji: '📎' },
}
export const KM_RATE = 0.26 // €/km exento (Orden HFP/792/2023)
const STATUS: Record<Expense['status'], [string, string]> = { pending: ['Pendiente', 'bg-warn/10 text-warn'], approved: ['Aprobado', 'bg-brand/10 text-brand'], paid: ['Pagado', 'bg-ok/10 text-ok'], rejected: ['Rechazado', 'bg-bad/10 text-bad'] }

/** Reglas de la política de gastos: se evalúan al registrar y se muestran al aprobar. */
export function checkPolicy(x: Pick<Expense, 'category' | 'amount' | 'date' | 'merchant' | 'receipt' | 'km'>, all: Expense[], empId: string) {
  const f: string[] = []
  const lim = CATS[x.category].limit
  if (lim && x.amount > lim) f.push(`Supera el límite de ${eur(lim, 0)} para ${CATS[x.category].label.toLowerCase()}`)
  if (isoDow(parseDay(x.date)) > 5) f.push('Fecha en fin de semana')
  if (x.category !== 'kilometraje' && !x.receipt) f.push('Sin justificante adjunto')
  if (all.some((y) => y.empId === empId && y.date === x.date && Math.abs(y.amount - x.amount) < 0.01)) f.push('Posible duplicado: mismo importe y fecha')
  if (parseDay(x.date).getTime() < Date.now() - 90 * 864e5) f.push('Más de 90 días de antigüedad')
  return f
}

export function ExpensesPage() {
  const s = useStore()
  const me = useMe()
  const [tab, setTab] = useState<'all' | 'pending' | 'paid'>('all')
  const [form, setForm] = useState<Partial<Expense> | null>(null)
  const mine = s.expenses.filter((x) => x.empId === me.id).sort((a, b) => b.date.localeCompare(a.date))
  const list = mine.filter((x) => tab === 'all' || (tab === 'pending' ? x.status === 'pending' || x.status === 'approved' : x.status === 'paid'))
  const toPay = mine.filter((x) => x.status === 'approved').reduce((a, x) => a + x.amount, 0)
  const pend = mine.filter((x) => x.status === 'pending').reduce((a, x) => a + x.amount, 0)
  const month = mine.filter((x) => x.date.startsWith(monthKey(new Date())) && x.status !== 'rejected').reduce((a, x) => a + x.amount, 0)

  const exportCsv = async () => {
    const rows = [['Fecha', 'Comercio', 'Categoría', 'Importe', 'IVA', 'Km', 'Estado', 'Nota'], ...mine.map((x) => [x.date, x.merchant, CATS[x.category].label, x.amount.toFixed(2).replace('.', ','), x.vat?.toFixed(2).replace('.', ',') ?? '', x.km ?? '', STATUS[x.status][0], x.note ?? ''])]
    const ok = await saveFile(`gastos-${me.name.replace(/\s/g, '_')}.csv`, '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv')
    toast(ok ? { title: 'Gastos exportados' } : { title: 'No se pudo descargar', tone: 'warn' })
  }

  return (
    <div>
      <PageHeader
        icon={<Receipt size={19} />}
        title="Gastos"
        subtitle="Haz una foto al ticket y se rellena solo"
        actions={
          <>
            <button className="btn-outline" onClick={exportCsv}><Download size={15} /> Exportar</button>
            <button className="btn-outline" onClick={() => setForm({ category: 'kilometraje', date: dayKey(new Date()), merchant: 'Kilometraje', km: 0, amount: 0 })}><Car size={15} /> Kilometraje</button>
          </>
        }
      />
      <Dropzone onReady={(f) => setForm(f)} />
      <div className="grid sm:grid-cols-3 gap-4 my-5">
        <div className="card p-4"><Stat label="Pendiente de aprobar" value={eur(pend)} /></div>
        <div className="card p-4"><Stat label="Aprobado, se paga con la nómina" value={eur(toPay)} tone="brand" /></div>
        <div className="card p-4"><Stat label={`Gastado en ${fmt(new Date(), 'MMMM')}`} value={eur(month)} /></div>
      </div>
      <div className="flex items-center mb-3">
        <Tabs value={tab} onChange={setTab} items={[{ id: 'all', label: 'Todos' }, { id: 'pending', label: 'En curso' }, { id: 'paid', label: 'Pagados' }]} />
      </div>
      <section className="card overflow-hidden">
        <AnimatePresence initial={false}>
          {list.map((x) => (
            <motion.div layout key={x.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line last:border-0 group">
              {x.receipt ? <img src={x.receipt} alt="" className="h-10 w-10 rounded-lg object-cover border border-line" /> : <span className="h-10 w-10 rounded-lg bg-sunken grid place-items-center text-lg">{CATS[x.category].emoji}</span>}
              <div className="flex-1 min-w-[180px]">
                <div className="text-sm font-medium flex items-center gap-1.5">{x.merchant}{x.ai && <Sparkles size={11} className="text-brand" />}</div>
                <div className="text-xs text-muted">{fmt(parseDay(x.date), 'EEE d MMM')} · {CATS[x.category].label}{x.km ? ` · ${x.km} km` : ''}{x.note ? ` · ${x.note}` : ''}</div>
              </div>
              {!!x.flags.length && <span className="chip bg-warn/10 text-warn" title={x.flags.join(' · ')}><AlertTriangle size={10} /> {x.flags.length}</span>}
              <span className={cx('chip', STATUS[x.status][1])}>{STATUS[x.status][0]}</span>
              <span className="w-24 text-right tabular-nums font-medium">{eur(x.amount)}</span>
              {x.status === 'pending' && <button onClick={() => s.deleteExpense(x.id)} className="text-muted hover:text-bad opacity-0 group-hover:opacity-100 transition" aria-label="Eliminar"><Trash2 size={14} /></button>}
            </motion.div>
          ))}
        </AnimatePresence>
        {!list.length && <Empty icon={<Receipt size={20} />} title="Sin gastos aquí" body="Arrastra un ticket arriba para empezar." />}
      </section>
      <ExpenseForm init={form} onClose={() => setForm(null)} />
    </div>
  )
}

async function thumb(file: File): Promise<{ thumb: string; blob: Blob }> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 1400 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = img.width * scale
  c.height = img.height * scale
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.85))
  const t = document.createElement('canvas')
  const ts = 160 / Math.max(c.width, c.height)
  t.width = c.width * ts
  t.height = c.height * ts
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height)
  return { thumb: t.toDataURL('image/jpeg', 0.7), blob }
}

function Dropzone({ onReady }: { onReady: (f: Partial<Expense>) => void }) {
  const [drag, setDrag] = useState(false)
  const [scan, setScan] = useState<string>()
  const [pct, setPct] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const handle = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast({ title: 'Sube una foto del ticket (JPG o PNG)', tone: 'warn' })
    const { thumb: t, blob } = await thumb(file)
    setScan(t)
    setPct(0)
    let data: ReceiptData | null = null
    try {
      data = await readReceipt(blob, setPct)
    } catch {
      data = null
    }
    setScan(undefined)
    const ok = !!data && data.total != null
    onReady({ receipt: t, merchant: data?.comercio ?? '', date: data?.fecha ?? dayKey(new Date()), amount: data?.total ?? 0, vat: data?.iva, category: data?.categoria ?? 'otros', ai: ok })
    toast(ok ? { title: 'Ticket leído', body: `${data!.comercio ?? 'Comercio'} · ${eur(data!.total!)}`, tone: 'ai' } : { title: 'No he podido leer todos los datos', body: 'Complétalos a mano; la foto queda adjunta.', tone: 'warn' })
  }
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]) }}
      onClick={() => !scan && input.current?.click()}
      className={cx('relative card border-dashed border-2 p-6 cursor-pointer transition overflow-hidden', drag ? 'border-brand bg-brand/5' : 'hover:border-brand/50')}
    >
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      {scan ? (
        <div className="flex items-center gap-5">
          <div className="relative h-24 w-20 rounded-lg overflow-hidden border border-line shrink-0">
            <img src={scan} alt="" className="h-full w-full object-cover" />
            <motion.div className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-brand/50 to-transparent" animate={{ y: [-32, 96] }} transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }} />
          </div>
          <div>
            <div className="font-medium flex items-center gap-2"><Loader2 size={15} className="animate-spin text-brand" /> Leyendo el ticket…</div>
            <div className="text-sm text-muted">Comercio, fecha, total, IVA y categoría · {Math.round(pct * 100)}%</div>
            <div className="h-1 w-48 rounded-full bg-sunken mt-2 overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${Math.max(6, pct * 100)}%` }} /></div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <span className="h-12 w-12 rounded-2xl grid place-items-center text-white shadow-glow" style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1 55%,#22d3ee)' }}><ScanLine size={22} /></span>
          <div className="flex-1 min-w-[200px]">
            <div className="font-medium">Arrastra un ticket o haz una foto</div>
            <div className="text-sm text-muted">Se lee en tu dispositivo: comercio, fecha, importe, IVA y categoría.</div>
          </div>
          <span className="btn-primary"><Upload size={15} /> Subir ticket</span>
        </div>
      )}
    </div>
  )
}

function ExpenseForm({ init, onClose }: { init: Partial<Expense> | null; onClose: () => void }) {
  const s = useStore()
  const me = useMe()
  const [f, setF] = useState<Partial<Expense>>({})
  const [last, setLast] = useState(init)
  if (init !== last) {
    setLast(init)
    setF(init ?? {})
  }
  if (!init) return <Modal open={false} onClose={onClose}>{null}</Modal>
  const km = f.category === 'kilometraje'
  const amount = km ? +((f.km ?? 0) * KM_RATE).toFixed(2) : f.amount ?? 0
  const draft = { category: f.category ?? 'otros', amount, date: f.date ?? dayKey(new Date()), merchant: f.merchant ?? '', receipt: f.receipt, km: f.km }
  const flags = checkPolicy(draft, s.expenses, me.id)
  const save = () => {
    s.addExpense({ ...draft, vat: f.vat, note: f.note, ai: f.ai, flags })
    toast({ title: 'Gasto enviado a aprobación', body: `${draft.merchant} · ${eur(amount)}` })
    onClose()
  }
  return (
    <Modal open={!!init} onClose={onClose} title={km ? 'Gasto de kilometraje' : 'Nuevo gasto'} icon={<Receipt size={18} className="text-brand" />}>
      <div className="flex gap-4">
        {f.receipt && <img src={f.receipt} alt="Ticket" className="h-32 w-24 rounded-xl object-cover border border-line shrink-0" />}
        <div className="flex-1 space-y-3">
          {f.ai && <div className="chip bg-brand/10 text-brand"><Sparkles size={10} /> Leído automáticamente · revísalo</div>}
          {!km && <div><label className="label" htmlFor="x-m">Comercio</label><input id="x-m" className="input" value={f.merchant ?? ''} onChange={(e) => setF({ ...f, merchant: e.target.value })} /></div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="x-d">Fecha</label><input id="x-d" type="date" className="input" value={f.date ?? ''} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            {km ? (
              <div><label className="label" htmlFor="x-km">Kilómetros</label><input id="x-km" type="number" min={0} className="input" value={f.km ?? 0} onChange={(e) => setF({ ...f, km: +e.target.value })} /></div>
            ) : (
              <div><label className="label" htmlFor="x-a">Importe (€)</label><input id="x-a" type="number" step="0.01" className="input" value={f.amount ?? 0} onChange={(e) => setF({ ...f, amount: +e.target.value })} /></div>
            )}
          </div>
          {!km && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="x-c">Categoría</label><select id="x-c" className="input" value={f.category ?? 'otros'} onChange={(e) => setF({ ...f, category: e.target.value as Expense['category'] })}>{Object.entries(CATS).filter(([k]) => k !== 'kilometraje').map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}</select></div>
              <div><label className="label" htmlFor="x-v">IVA (€)</label><input id="x-v" type="number" step="0.01" className="input" value={f.vat ?? ''} onChange={(e) => setF({ ...f, vat: e.target.value ? +e.target.value : undefined })} /></div>
            </div>
          )}
          <div><label className="label" htmlFor="x-n">{km ? 'Trayecto' : 'Motivo'}</label><input id="x-n" className="input" value={f.note ?? ''} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={km ? 'Madrid → Toledo → Madrid' : 'Comida con cliente'} /></div>
        </div>
      </div>
      {km && <div className="text-sm mt-3">{f.km ?? 0} km × {KM_RATE.toFixed(2).replace('.', ',')} €/km = <b>{eur(amount)}</b> <span className="text-muted">(exento de IRPF)</span></div>}
      {!!flags.length && <AiNote className="mt-4"><div className="text-sm"><b>Revisa antes de enviar:</b> {flags.join(' · ')}.</div></AiNote>}
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-brand" disabled={!amount || (!km && !f.merchant)} onClick={save}>Enviar a aprobación</button>
      </div>
    </Modal>
  )
}
