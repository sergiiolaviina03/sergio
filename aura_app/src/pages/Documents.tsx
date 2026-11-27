import { FileSignature, FileText, Folder, Download, Check, ShieldCheck, Sparkles, Plus, Bell, Paperclip, Loader2, Clock3, Lock, ScrollText, ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { differenceInCalendarDays } from 'date-fns'
import { useMe, useStore } from '../store'
import type { DocCategory, HRDocument } from '../types'
import { AiNote, Avatar, Empty, Modal, PageHeader, Tabs, Toggle, cx, toast } from '../components/ui'
import { SignaturePad } from '../components/SignaturePad'
import { cap, dayKey, fmt, parseDay } from '../lib/time'
import { signedDocPdf } from '../lib/pdf'
import { saveFile } from '../lib/platform'
import { TEMPLATES, summarizeDoc } from '../data/templates'
import { sha256 } from '../lib/sha256'
import { short } from '../lib/ledger'
import { create } from 'zustand'

const CAT: Record<DocCategory, string> = { contrato: 'Contratos', politica: 'Políticas', registro: 'Registro de jornada', anexo: 'Anexos', otros: 'Otros' }

export const useSignFlow = create<{ docId?: string; open: (id: string) => void; close: () => void }>((set) => ({ open: (docId) => set({ docId }), close: () => set({ docId: undefined }) }))

export function usePendingDocs() {
  const docs = useStore((s) => s.documents)
  const meId = useStore((s) => s.meId)
  return docs.filter((d) => d.requireSignature && d.audience.includes(meId) && !d.signatures.some((s) => s.empId === meId))
}

export function dueLabel(due?: string) {
  if (!due) return null
  const n = differenceInCalendarDays(parseDay(due), new Date())
  return n < 0 ? { t: `Vencido hace ${-n} d`, tone: 'bad' as const } : n === 0 ? { t: 'Vence hoy', tone: 'bad' as const } : n <= 3 ? { t: `Vence en ${n} d`, tone: 'warn' as const } : { t: `Vence el ${fmt(parseDay(due), 'd MMM')}`, tone: 'muted' as const }
}

export function DocumentsPage() {
  const s = useStore()
  const me = useMe()
  const manager = s.settings.viewAs === 'manager'
  const pending = usePendingDocs()
  const [tab, setTab] = useState<'pending' | 'all' | 'sent'>(pending.length ? 'pending' : 'all')
  const [folder, setFolder] = useState<DocCategory | 'all'>('all')
  const [compose, setCompose] = useState(false)
  const openSign = useSignFlow((x) => x.open)
  const mine = s.documents.filter((d) => d.audience.includes(me.id))
  const list = mine.filter((d) => folder === 'all' || d.category === folder)
  const sent = s.documents.filter((d) => d.audience.length > 1)

  return (
    <div>
      <PageHeader
        icon={<FileSignature size={19} />}
        title="Documentos"
        subtitle="Contratos, políticas y registros con firma electrónica sellada"
        actions={manager ? <button className="btn-brand" onClick={() => setCompose(true)}><Plus size={15} /> Enviar a firmar</button> : undefined}
        tabs={<Tabs value={tab} onChange={setTab} items={[{ id: 'pending', label: <>Por firmar {!!pending.length && <span className="chip bg-bad text-white ml-1">{pending.length}</span>}</> }, { id: 'all', label: 'Mis documentos' }, ...(manager ? [{ id: 'sent' as const, label: 'Seguimiento' }] : [])]} />}
      />

      {tab === 'pending' && (
        pending.length ? (
          <div className="grid md:grid-cols-2 gap-4">
            {pending.map((d) => {
              const due = dueLabel(d.due)
              return (
                <motion.div key={d.id} layout className={cx('card p-5 flex flex-col', d.mandatory && 'aurora-border')}>
                  <div className="flex items-start gap-3">
                    <span className="h-10 w-10 rounded-xl grid place-items-center bg-brand/10 text-brand shrink-0"><ScrollText size={18} /></span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{d.title}</div>
                      <div className="text-xs text-muted mt-0.5">{CAT[d.category]} · enviado {fmt(d.createdAt, 'd MMM')} por {s.employees.find((e) => e.id === d.createdBy)?.name.split(' ')[0]}</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted mt-3 line-clamp-2">{d.body.replace(/## [^\n]+\n/g, '').slice(0, 180)}…</p>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {d.mandatory && <span className="chip bg-bad/10 text-bad">Obligatorio</span>}
                    {due && <span className={cx('chip', due.tone === 'bad' ? 'bg-bad/10 text-bad' : due.tone === 'warn' ? 'bg-warn/10 text-warn' : 'bg-sunken text-muted')}><Clock3 size={10} /> {due.t}</span>}
                    <span className="chip bg-sunken text-muted">{d.signatures.length}/{d.audience.length} firmados</span>
                    <button className="btn-brand ml-auto" onClick={() => openSign(d.id)}><FileSignature size={15} /> Leer y firmar</button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="card"><Empty icon={<Check size={20} />} title="Nada pendiente de firma" body="Cuando la empresa te envíe un documento, aparecerá aquí y te avisaremos." /></div>
        )
      )}

      {tab === 'all' && (
        <div className="grid lg:grid-cols-[240px_1fr] gap-5">
          <div className="card p-2 h-fit">
            {(['all', 'contrato', 'politica', 'registro', 'anexo'] as const).map((c) => {
              const n = c === 'all' ? mine.length : mine.filter((d) => d.category === c).length
              return (
                <button key={c} onClick={() => setFolder(c)} className={cx('w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-sm transition', folder === c ? 'bg-sunken font-medium' : 'text-muted hover:bg-sunken/60')}>
                  <Folder size={15} className={folder === c ? 'text-brand' : ''} />
                  <span className="flex-1 text-left">{c === 'all' ? 'Todos' : CAT[c]}</span>
                  <span className="text-xs tabular-nums">{n}</span>
                </button>
              )
            })}
          </div>
          <section className="card overflow-hidden">
            {list.map((d) => {
              const my = d.signatures.find((x) => x.empId === me.id)
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line last:border-0 hover:bg-sunken/40">
                  <FileText size={17} className="text-muted" />
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-sm font-medium">{d.title}</div>
                    <div className="text-xs text-muted">{CAT[d.category]} · {fmt(d.createdAt, 'd MMM yyyy')}{d.attachment && ` · ${d.attachment.name}`}</div>
                  </div>
                  {my ? <span className="chip bg-ok/10 text-ok"><Check size={10} /> Firmado {fmt(my.ts, 'd MMM')}</span> : d.requireSignature ? <span className="chip bg-warn/10 text-warn">Pendiente</span> : <span className="chip bg-sunken text-muted">Informativo</span>}
                  {my ? <DownloadSigned doc={d} empId={me.id} /> : <button className="btn-outline h-8 text-xs" onClick={() => openSign(d.id)}>Abrir</button>}
                </div>
              )
            })}
            {!list.length && <Empty icon={<Folder size={20} />} title="Carpeta vacía" />}
          </section>
        </div>
      )}

      {tab === 'sent' && (
        <div className="space-y-4">
          {sent.map((d) => {
            const pct = d.signatures.length / d.audience.length
            const missing = d.audience.filter((id) => !d.signatures.some((x) => x.empId === id))
            const due = dueLabel(d.due)
            return (
              <div key={d.id} className="card p-5 flex flex-wrap gap-5 items-center">
                <div className="relative h-14 w-14 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(var(--line))" strokeWidth="3.5" /><circle cx="18" cy="18" r="15.5" fill="none" stroke={pct === 1 ? 'rgb(var(--ok))' : 'rgb(var(--brand))'} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${pct * 97.4} 97.4`} /></svg>
                  <span className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">{Math.round(pct * 100)}%</span>
                </div>
                <div className="flex-1 min-w-[220px]">
                  <div className="font-medium flex items-center gap-2">{d.title} {d.mandatory && <span className="chip bg-bad/10 text-bad">Obligatorio</span>}</div>
                  <div className="text-xs text-muted mt-0.5">{d.signatures.length} de {d.audience.length} firmas{due && ` · ${due.t.toLowerCase()}`}</div>
                  {!!missing.length && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex -space-x-1.5">{missing.slice(0, 8).map((id) => <Avatar key={id} emp={s.employees.find((e) => e.id === id)!} size={24} />)}</div>
                      <span className="text-xs text-muted">pendientes</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {!!missing.length && <button className="btn-outline" onClick={() => toast({ title: `Recordatorio enviado a ${missing.length} persona${missing.length > 1 ? 's' : ''}`, tone: 'ai' })}><Bell size={14} /> Recordar</button>}
                  <DownloadSigned doc={d} label="Acta de firmas" />
                </div>
              </div>
            )
          })}
        </div>
      )}
      <Compose open={compose} onClose={() => setCompose(false)} />
    </div>
  )
}

function DownloadSigned({ doc, empId, label = 'PDF firmado' }: { doc: HRDocument; empId?: string; label?: string }) {
  const emps = useStore((s) => s.employees)
  const [busy, setBusy] = useState(false)
  return (
    <button
      className="btn-outline h-8 text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        const blob = await signedDocPdf(doc, emps, empId)
        const ok = await saveFile(`${doc.title.replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')}_firmado.pdf`, blob)
        setBusy(false)
        toast(ok ? { title: 'PDF firmado descargado' } : { title: 'No se pudo descargar', body: 'Permite las descargas para esta página e inténtalo de nuevo.', tone: 'warn' })
      }}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} {label}
    </button>
  )
}

/** Flujo de firma: lectura completa → resumen IA opcional → firma → sellado. */
export function SignFlow() {
  const { docId, close } = useSignFlow()
  const s = useStore()
  const me = useMe()
  const doc = s.documents.find((d) => d.id === docId)
  const [step, setStep] = useState<'read' | 'sign' | 'seal' | 'done'>('read')
  const [progress, setProgress] = useState(0)
  const [accept, setAccept] = useState(false)
  const [sig, setSig] = useState<{ png: string | null; method: 'drawn' | 'typed' }>({ png: null, method: 'drawn' })
  const [summary, setSummary] = useState<string>()
  const opened = useRef(Date.now())
  const already = doc?.signatures.find((x) => x.empId === me.id)

  useEffect(() => {
    if (!docId) return
    setStep('read')
    setProgress(0)
    setAccept(false)
    setSummary(undefined)
    opened.current = Date.now()
  }, [docId])

  if (!doc) return <Modal open={false} onClose={close}>{null}</Modal>

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    setProgress(Math.min(1, (el.scrollTop + el.clientHeight) / el.scrollHeight))
  }
  const summarize = () => setSummary(summarizeDoc(doc.body))
  const doSign = async () => {
    if (!sig.png) return
    setStep('seal')
    await new Promise((r) => setTimeout(r, 1400))
    s.signDocument(doc.id, { image: sig.png, method: sig.method, readSeconds: (Date.now() - opened.current) / 1000, device: navigator.userAgent.replace(/\(.*?\)/g, '').trim().slice(0, 80) })
    setStep('done')
    if (navigator.vibrate) navigator.vibrate([10, 30, 20])
  }
  const scrolledEnough = progress > 0.97
  const signedNow = s.documents.find((d) => d.id === doc.id)?.signatures.find((x) => x.empId === me.id)

  return (
    <Modal open={!!docId} onClose={close} wide title={doc.title} icon={<span className="h-8 w-8 rounded-lg bg-brand/10 text-brand grid place-items-center"><FileSignature size={16} /></span>}>
      <AnimatePresence mode="wait">
        {step === 'read' && (
          <motion.div key="read" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-muted">
              <span className="font-mono">Huella {short(doc.hash)}</span>
              {doc.mandatory && <span className="chip bg-bad/10 text-bad">Obligatorio</span>}
              {!summary && <button onClick={summarize} className="chip h-7 px-2.5 bg-brand/10 text-brand ml-auto hover:bg-brand/15"><Sparkles size={11} /> Ver resumen</button>}
            </div>
            {summary && <AiNote className="mb-3"><div className="whitespace-pre-line text-sm">{summary}</div></AiNote>}
            <div className="relative">
              <div onScroll={onScroll} className="h-[44vh] overflow-auto rounded-2xl border border-line bg-sunken/40 px-6 py-5 text-[14.5px] leading-relaxed">
                {doc.body.split('\n\n').map((b, i) => (
                  <div key={i} className="mb-4">
                    {b.split('\n').map((l, j) => (l.startsWith('## ') ? <h4 key={j} className="font-semibold text-ink mt-2 mb-1">{l.slice(3)}</h4> : <p key={j} className="text-ink/85">{l}</p>))}
                  </div>
                ))}
                {doc.attachment && <div className="mt-4 flex items-center gap-2 text-sm"><Paperclip size={14} /> {doc.attachment.name} · {(doc.attachment.size / 1024).toFixed(0)} KB · huella {short(doc.attachment.hash)}</div>}
              </div>
              <div className="absolute left-0 right-0 bottom-0 h-1 rounded-b-2xl bg-line overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${progress * 100}%` }} /></div>
            </div>
            {already ? (
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <span className="chip bg-ok/10 text-ok"><Check size={11} /> Firmado el {fmt(already.ts, "d MMM yyyy 'a las' HH:mm")}</span>
                <span className="ml-auto"><DownloadSigned doc={doc} empId={me.id} /></span>
              </div>
            ) : doc.requireSignature ? (
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <label className={cx('flex items-center gap-2 text-sm', !scrolledEnough && 'opacity-50')}>
                  <input type="checkbox" disabled={!scrolledEnough} checked={accept} onChange={(e) => setAccept(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                  He leído el documento completo y lo acepto
                </label>
                {!scrolledEnough && <span className="text-xs text-muted">Desplázate hasta el final para continuar</span>}
                <button className="btn-brand ml-auto" disabled={!accept} onClick={() => setStep('sign')}>Continuar <ArrowRight size={15} /></button>
              </div>
            ) : null}
          </motion.div>
        )}
        {step === 'sign' && (
          <motion.div key="sign" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <SignaturePad name={me.name} onChange={(png, method) => setSig({ png, method })} />
            <div className="text-xs text-muted mt-3 flex gap-1.5"><Lock size={12} className="mt-0.5 shrink-0" /> Tu firma se une a la huella del documento, la fecha y hora exactas y este dispositivo en un sello SHA-256. Firma electrónica simple conforme al reglamento eIDAS.</div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-ghost" onClick={() => setStep('read')}>Atrás</button>
              <button className="btn-brand" disabled={!sig.png} onClick={doSign}><FileSignature size={15} /> Firmar documento</button>
            </div>
          </motion.div>
        )}
        {step === 'seal' && (
          <motion.div key="seal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 grid place-items-center text-center">
            <div className="relative h-24 w-24">
              {[0, 1, 2].map((i) => <span key={i} className="absolute inset-0 rounded-full border border-brand/40 animate-ping2" style={{ animationDelay: `${i * 0.4}s` }} />)}
              <div className="absolute inset-5 rounded-full bg-brand text-white grid place-items-center shadow-glow"><ShieldCheck size={24} /></div>
            </div>
            <div className="font-medium mt-5">Sellando tu firma…</div>
            <div className="font-mono text-xs text-muted mt-1">{sha256(doc.hash + me.id + Date.now()).slice(0, 48)}…</div>
          </motion.div>
        )}
        {step === 'done' && signedNow && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="py-4">
            <div className="flex flex-col items-center text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }} className="h-14 w-14 rounded-full bg-ok text-white grid place-items-center"><Check size={28} strokeWidth={3} /></motion.div>
              <div className="text-lg font-semibold mt-3">Documento firmado</div>
              <div className="text-sm text-muted">{fmt(signedNow.ts, "d 'de' MMMM yyyy 'a las' HH:mm:ss")}</div>
              <img src={signedNow.image} alt="Tu firma" className="h-16 mt-4 dark:invert" />
              <div className="font-mono text-[11px] text-muted mt-3 break-all max-w-md">Sello {signedNow.hash}</div>
              <div className="flex gap-2 mt-5">
                <DownloadSigned doc={s.documents.find((d) => d.id === doc.id)!} empId={me.id} />
                <button className="btn-primary h-8 text-xs" onClick={close}>Hecho</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  )
}

function Compose({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore()
  const [f, setF] = useState({ title: '', category: 'politica' as DocCategory, body: '', mandatory: true, due: dayKey(Date.now() + 7 * 864e5), audience: 'all' as 'all' | 'team' })
  const [att, setAtt] = useState<HRDocument['attachment']>()
  const send = () => {
    const audience = f.audience === 'all' ? s.employees.map((e) => e.id) : s.employees.filter((e) => e.managerId === s.meId || e.id === s.meId).map((e) => e.id)
    s.createDocument({ title: f.title, category: f.category, body: f.body, mandatory: f.mandatory, requireSignature: true, due: f.due, audience, attachment: att })
    s.notify({ title: `Nuevo documento para firmar: ${f.title}` })
    toast({ title: 'Documento enviado', body: `${audience.length} personas recibirán un aviso para firmarlo.`, tone: 'ai' })
    setF({ ...f, title: '', body: '' })
    setAtt(undefined)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} wide title="Enviar documento a firmar" icon={<FileSignature size={18} className="text-brand" />}>
      <div className="grid sm:grid-cols-[1fr_180px] gap-3">
        <div><label className="label" htmlFor="doc-title">Título</label><input id="doc-title" className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej.: Política de uso de vehículos de empresa" /></div>
        <div><label className="label" htmlFor="doc-cat">Carpeta</label><select id="doc-cat" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as DocCategory })}>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      </div>
      <div className="mt-3">
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5"><label className="label mb-0 mr-auto" htmlFor="doc-body">Contenido</label><span className="text-xs text-muted">Plantillas:</span>{TEMPLATES.map((t) => <button key={t.id} onClick={() => setF({ ...f, title: t.title, category: t.category, body: t.body })} className="chip h-7 px-2.5 bg-sunken border border-line text-ink hover:bg-brand/10">{t.title.split(' ').slice(0, 3).join(' ')}</button>)}</div>
        <textarea id="doc-body" className="input h-56 py-2.5 leading-relaxed" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder={'## Objeto\nTexto…\n\n## Aceptación\nCon tu firma…'} />
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mt-3 items-end">
        <div><label className="label" htmlFor="doc-due">Fecha límite</label><input id="doc-due" type="date" className="input" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></div>
        <div><label className="label" htmlFor="doc-aud">Destinatarios</label><select id="doc-aud" className="input" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value as 'all' | 'team' })}><option value="all">Toda la empresa ({s.employees.length})</option><option value="team">Mi equipo</option></select></div>
        <label className="btn-outline cursor-pointer"><Paperclip size={14} /> {att ? att.name.slice(0, 18) : 'Adjuntar PDF'}<input type="file" accept="application/pdf" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const buf = new Uint8Array(await file.arrayBuffer())
          let bin = ''
          for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192))
          setAtt({ name: file.name, size: file.size, hash: sha256(bin) })
        }} /></label>
      </div>
      <Toggle on={f.mandatory} onChange={(v) => setF({ ...f, mandatory: v })} label="Firma obligatoria" hint="Se mostrará como bloqueante en el inicio hasta que la persona lo firme." />
      <div className="flex justify-end gap-2 mt-2">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-brand" disabled={!f.title || f.body.length < 20} onClick={send}>Enviar</button>
      </div>
    </Modal>
  )
}

/** Recordatorio al abrir la app si hay documentos obligatorios sin firmar. */
export function MandatoryGate() {
  const pending = usePendingDocs().filter((d) => d.mandatory)
  const [shown, setShown] = useState(() => {
    try {
      return sessionStorage.getItem('aura-gate') === '1'
    } catch {
      return false
    }
  })
  const openSign = useSignFlow((x) => x.open)
  const open = !shown && pending.length > 0
  const dismiss = () => {
    setShown(true)
    try {
      sessionStorage.setItem('aura-gate', '1')
    } catch {
      /* sin almacenamiento */
    }
  }
  const sorted = useMemo(() => [...pending].sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9')), [pending])
  return (
    <Modal open={open} onClose={dismiss} title="Tienes documentos obligatorios por firmar" icon={<span className="h-8 w-8 rounded-lg bg-bad/10 text-bad grid place-items-center"><FileSignature size={16} /></span>}>
      <div className="space-y-2">
        {sorted.map((d) => {
          const due = dueLabel(d.due)
          return (
            <button key={d.id} onClick={() => { dismiss(); openSign(d.id) }} className="w-full flex items-center gap-3 p-3 rounded-xl border border-line hover:bg-sunken text-left transition">
              <ScrollText size={16} className="text-brand shrink-0" />
              <span className="flex-1 text-sm font-medium">{d.title}</span>
              {due && <span className={cx('chip', due.tone === 'bad' ? 'bg-bad/10 text-bad' : due.tone === 'warn' ? 'bg-warn/10 text-warn' : 'bg-sunken text-muted')}>{due.t}</span>}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between items-center mt-5">
        <span className="text-xs text-muted">{cap(fmt(new Date(), "EEEE d 'de' MMMM"))}</span>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={dismiss}>Más tarde</button>
          <button className="btn-brand" onClick={() => { dismiss(); openSign(sorted[0].id) }}>Firmar ahora</button>
        </div>
      </div>
    </Modal>
  )
}
