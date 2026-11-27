import { Upload, FileSpreadsheet, FileText, FolderOpen, Check, AlertTriangle, ArrowRight, ArrowLeft, Loader2, Users2, Timer, CalendarDays, Sparkles, X, PartyPopper } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import type { DocCategory, Employee, Punch, PunchType, TimeOffRequest } from '../types'
import { AiNote, Avatar, PageHeader, Section, cx, toast } from '../components/ui'
import { FIELDS, SOURCES, absenceStatus, absenceType, autoMap, detectKind, guessCategory, makeMatcher, matchFile, norm, parseDate, parseTime, readSpreadsheet, splitName, toKey, type Kind, type Sheet } from '../lib/importer'
import { putFile } from '../lib/files'
import { uid } from '../lib/rng'
import { dayKey } from '../lib/time'
import { CAT } from './Documents'
import { go } from '../lib/nav'

type SheetState = Sheet & { kind: Kind; map: Record<string, string> }
type DocFile = { file: File; path: string; empId: string | 'empresa' | ''; category: DocCategory; title: string }
type Report = { employees: number; updated: number; punches: number; absences: number; documents: number; skipped: string[] }

const SHEET_EXT = /\.(xlsx|xls|xlsm|ods|csv|tsv)$/i
const DOC_EXT = /\.(pdf|png|jpe?g|webp|heic|docx?|odt|txt)$/i
const KIND_LABEL: Record<Kind, string> = { employees: 'Plantilla', punches: 'Fichajes', absences: 'Ausencias', ignore: 'No importar' }
const KIND_ICON: Record<Kind, React.ReactNode> = { employees: <Users2 size={14} />, punches: <Timer size={14} />, absences: <CalendarDays size={14} />, ignore: <X size={14} /> }

export function ImportPage() {
  const s = useStore()
  const [step, setStep] = useState<'source' | 'files' | 'review' | 'running' | 'done'>('source')
  const [source, setSource] = useState(SOURCES[0])
  const [sheets, setSheets] = useState<SheetState[]>([])
  const [docs, setDocs] = useState<DocFile[]>([])
  const [backup, setBackup] = useState<Record<string, unknown> | null>(null)
  const [reading, setReading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' })
  const [report, setReport] = useState<Report>()
  const [active, setActive] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const dirInput = useRef<HTMLInputElement>(null)

  // Empleados que existirán tras importar la plantilla (para emparejar fichajes, ausencias y documentos)
  const projected = useMemo(() => {
    const list: Employee[] = [...s.employees]
    for (const sh of sheets.filter((x) => x.kind === 'employees')) {
      const match = makeMatcher(list)
      for (const r of sh.rows) {
        const name = splitName(r, sh.map)
        if (!name) continue
        const email = sh.map.email ? String(r[sh.map.email] ?? '').trim() : ''
        const dni = sh.map.dni ? String(r[sh.map.dni] ?? '').trim() : ''
        if (!(email && match(email)) && !(dni && match(dni)) && !match(name)) list.push({ ...blankEmp(), id: 'new:' + norm(name), name, email, dni })
      }
    }
    return list
  }, [sheets, s.employees]) // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = async (files: FileList | File[]) => {
    setReading(true)
    const arr = Array.from(files)
    const newSheets: SheetState[] = []
    const newDocs: DocFile[] = []
    for (const f of arr) {
      const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
      if (/\.json$/i.test(f.name)) {
        try {
          const j = JSON.parse(await f.text())
          if (j?.app === 'aura') setBackup(j)
        } catch {
          toast({ title: `${f.name} no es una copia de Aura válida`, tone: 'warn' })
        }
      } else if (SHEET_EXT.test(f.name)) {
        try {
          for (const sh of await readSpreadsheet(f)) {
            const kind = detectKind(sh.headers)
            newSheets.push({ ...sh, kind, map: kind === 'ignore' ? {} : autoMap(kind, sh.headers) })
          }
        } catch (e) {
          toast({ title: `No se pudo leer ${f.name}`, body: (e as Error).message, tone: 'bad' })
        }
      } else if (DOC_EXT.test(f.name)) {
        const g = guessCategory(path)
        newDocs.push({ file: f, path, empId: '', category: g.category, title: g.title })
      }
    }
    setSheets((x) => [...x, ...newSheets])
    setDocs((x) => [...x, ...newDocs])
    setReading(false)
  }

  // Emparejamiento automático de documentos (se recalcula cuando cambia la plantilla prevista)
  const docsMatched = useMemo(() => docs.map((d) => (d.empId ? d : { ...d, empId: matchFile(d.path, projected)?.id ?? (/(politica|protocolo|manual|codigo|convenio|calendario)/.test(norm(d.path)) ? 'empresa' : '') })), [docs, projected])

  const run = async () => {
    setStep('running')
    const rep: Report = { employees: 0, updated: 0, punches: 0, absences: 0, documents: 0, skipped: [] }
    try {
      if (backup) await restoreBackup(backup, rep, setProgress)
      // 1. Plantilla
      const idMap = new Map<string, string>()
      for (const sh of sheets.filter((x) => x.kind === 'employees')) {
        const zones = useStore.getState().zones
        const pending: { emp: Employee; manager?: string }[] = []
        for (const [i, r] of sh.rows.entries()) {
          setProgress({ done: i, total: sh.rows.length, label: 'Plantilla' })
          const name = splitName(r, sh.map)
          if (!name) {
            rep.skipped.push(`${sh.file} fila ${i + 2}: sin nombre`)
            continue
          }
          const get = (k: string) => (sh.map[k] ? r[sh.map[k]] : undefined)
          const match = makeMatcher(useStore.getState().employees)
          const email = String(get('email') ?? '').trim() || undefined
          const dni = String(get('dni') ?? '').trim().toUpperCase() || undefined
          const existing = (email && match(email)) || (dni && match(dni)) || match(name)
          const zoneName = norm(get('zone'))
          const zone = zones.find((z) => zoneName && (norm(z.name).includes(zoneName) || zoneName.includes(norm(z.name).split(' ')[0])))
          const hired = parseDate(get('hiredAt'))
          const birth = parseDate(get('birthday'))
          const salary = Number(String(get('salary') ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'))
          const hours = Number(String(get('weeklyHours') ?? '').replace(',', '.'))
          const contract = norm(get('contract'))
          const base = existing ?? blankEmp()
          const emp: Employee = {
            ...base,
            name,
            email: email ?? base.email,
            dni: dni ?? base.dni,
            phone: String(get('phone') ?? '').trim() || base.phone,
            role: String(get('role') ?? '').trim() || base.role || 'Sin puesto',
            team: String(get('team') ?? '').trim() || base.team || 'General',
            zoneId: zone?.id ?? base.zoneId ?? zones[0]?.id ?? '',
            hiredAt: hired ? toKey(hired) : base.hiredAt,
            birthday: birth ? toKey(birth).slice(5) : base.birthday,
            salary: salary > 1000 ? salary : base.salary,
            weeklyHours: hours > 0 && hours <= 60 ? hours : base.weeklyHours,
            contract: contract ? (/temp|durac|obra|interin|eventual/.test(contract) ? 'temporal' : 'indefinido') : base.contract,
          }
          pending.push({ emp, manager: String(get('manager') ?? '').trim() || undefined })
          idMap.set('new:' + norm(name), emp.id)
          if (existing) rep.updated++
          else rep.employees++
          useStore.getState().upsertEmployee(emp)
        }
        // Segunda pasada: responsables por nombre
        const m2 = makeMatcher(useStore.getState().employees)
        for (const p of pending) if (p.manager) {
          const mgr = m2(p.manager)
          if (mgr && mgr.id !== p.emp.id) useStore.getState().upsertEmployee({ ...useStore.getState().employees.find((e) => e.id === p.emp.id)!, managerId: mgr.id })
        }
      }
      const match = makeMatcher(useStore.getState().employees)
      // 2. Fichajes históricos
      const drafts: Omit<Punch, 'seq' | 'prevHash' | 'hash'>[] = []
      for (const sh of sheets.filter((x) => x.kind === 'punches')) {
        const get = (r: Record<string, unknown>, k: string) => (sh.map[k] ? r[sh.map[k]] : undefined)
        for (const [i, r] of sh.rows.entries()) {
          const e = match(get(r, 'employee'))
          if (!e) {
            rep.skipped.push(`${sh.file} fila ${i + 2}: no se encontró a «${get(r, 'employee') ?? ''}»`)
            continue
          }
          const meta = { empId: e.id, method: 'import' as const, flags: ['importado'], note: `Origen: ${source.name}` }
          const zone = useStore.getState().zones.find((z) => norm(get(r, 'zone')) && norm(z.name).includes(norm(get(r, 'zone'))))
          if (sh.map.in || sh.map.out) {
            const d = parseDate(get(r, 'date')) ?? parseDate(get(r, 'in'))
            const a = parseTime(get(r, 'in'))
            const b = parseTime(get(r, 'out'))
            if (!d || a == null) {
              rep.skipped.push(`${sh.file} fila ${i + 2}: fecha u hora de entrada no válida`)
              continue
            }
            const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
            const tin = day + a * 60000
            let tout = b != null ? day + b * 60000 : undefined
            if (tout != null && tout <= tin) tout += 864e5 // turno de noche
            drafts.push({ ...meta, id: uid('p_'), type: 'in', ts: tin, zoneId: zone?.id })
            const br = Number(get(r, 'breakMin') ?? 0)
            if (br > 0 && tout) {
              const mid = tin + (tout - tin) / 2 - (br * 60000) / 2
              drafts.push({ ...meta, id: uid('p_'), type: 'break_start', ts: Math.round(mid) })
              drafts.push({ ...meta, id: uid('p_'), type: 'break_end', ts: Math.round(mid + br * 60000) })
            }
            if (tout) drafts.push({ ...meta, id: uid('p_'), type: 'out', ts: tout, zoneId: zone?.id })
          } else {
            const when = parseDate(get(r, 'datetime')) ?? parseDate(get(r, 'date'))
            const t = norm(get(r, 'type'))
            const type: PunchType | null = /fin.*pausa|pausa.*fin|vuelta|resume|break end/.test(t) ? 'break_end' : /pausa|descanso|break/.test(t) ? 'break_start' : /salida|out|fin|end|stop/.test(t) ? 'out' : /entrada|in|inicio|start/.test(t) ? 'in' : null
            if (!when || !type) {
              rep.skipped.push(`${sh.file} fila ${i + 2}: evento no reconocido`)
              continue
            }
            drafts.push({ ...meta, id: uid('p_'), type, ts: when.getTime(), zoneId: zone?.id })
          }
        }
      }
      if (drafts.length) {
        setProgress({ done: 0, total: drafts.length, label: 'Sellando fichajes' })
        rep.punches = await useStore.getState().importPunches(drafts)
      }
      // 3. Ausencias
      for (const sh of sheets.filter((x) => x.kind === 'absences')) {
        const get = (r: Record<string, unknown>, k: string) => (sh.map[k] ? r[sh.map[k]] : undefined)
        const reqs: TimeOffRequest[] = []
        for (const [i, r] of sh.rows.entries()) {
          const e = match(get(r, 'employee'))
          const from = parseDate(get(r, 'from'))
          const to = parseDate(get(r, 'to')) ?? from
          if (!e || !from || !to) {
            rep.skipped.push(`${sh.file} fila ${i + 2}: ${!e ? `no se encontró a «${get(r, 'employee') ?? ''}»` : 'fechas no válidas'}`)
            continue
          }
          const hours = Number(get(r, 'hours') ?? 0)
          reqs.push({ id: uid('r_'), empId: e.id, typeId: absenceType(get(r, 'type')), from: toKey(from), to: toKey(to), hours: hours > 0 ? hours : undefined, note: [String(get(r, 'note') ?? '').trim(), `Importado de ${source.name}`].filter(Boolean).join(' · '), status: absenceStatus(get(r, 'status')), createdAt: Date.now(), decidedBy: useStore.getState().meId })
        }
        useStore.setState({ requests: [...useStore.getState().requests, ...reqs] })
        rep.absences += reqs.length
      }
      // 4. Documentos
      const toUpload = docsMatched.filter((d) => d.empId)
      for (const [i, d] of toUpload.entries()) {
        setProgress({ done: i, total: toUpload.length, label: 'Subiendo documentos' })
        const empId = d.empId.startsWith('new:') ? idMap.get(d.empId) ?? '' : d.empId
        if (!empId) continue
        const buf = await d.file.arrayBuffer()
        const hash = crypto.subtle ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), (b) => b.toString(16).padStart(2, '0')).join('') : ''
        const fileId = await putFile(new Blob([buf], { type: d.file.type }), d.file.name, empId === 'empresa' ? 'empresa' : empId)
        useStore.getState().createDocument({
          title: d.title,
          category: d.category,
          body: `## Documento importado\nImportado desde ${source.name} el ${new Date().toLocaleDateString('es-ES')}. Archivo original: ${d.path}.`,
          mandatory: false,
          requireSignature: false,
          audience: empId === 'empresa' ? useStore.getState().employees.map((e) => e.id) : [empId],
          attachment: { name: d.file.name, size: d.file.size, hash, fileId, type: d.file.type },
        })
        rep.documents++
      }
      rep.skipped.push(...docsMatched.filter((d) => !d.empId).map((d) => `${d.path}: sin persona asignada`))
      setReport(rep)
      setStep('done')
    } catch (e) {
      toast({ title: 'La importación se detuvo', body: (e as Error).message, tone: 'bad' })
      setReport(rep)
      setStep('done')
    }
  }

  const counts = {
    employees: sheets.filter((x) => x.kind === 'employees').reduce((a, x) => a + x.rows.length, 0),
    punches: sheets.filter((x) => x.kind === 'punches').reduce((a, x) => a + x.rows.length, 0),
    absences: sheets.filter((x) => x.kind === 'absences').reduce((a, x) => a + x.rows.length, 0),
    docs: docsMatched.length,
    docsOk: docsMatched.filter((d) => d.empId).length,
  }

  return (
    <div>
      <PageHeader icon={<Upload size={19} />} title="Importar a Aura" subtitle="Trae tu plantilla, el histórico de fichajes, las ausencias y todos los documentos en unos minutos" />
      <Steps step={step} />

      {step === 'source' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SOURCES.map((src) => (
            <button key={src.id} onClick={() => { setSource(src); setStep('files') }} className={cx('card p-5 text-left hover:shadow-pop transition group', source.id === src.id && 'ring-2 ring-brand')}>
              <div className="font-semibold flex items-center gap-2">{src.name}<ArrowRight size={14} className="ml-auto text-muted group-hover:text-brand transition" /></div>
              <p className="text-xs text-muted mt-2 leading-relaxed">{src.how}</p>
            </button>
          ))}
        </div>
      )}

      {step === 'files' && (
        <div className="space-y-5">
          <AiNote><b>Cómo exportar desde {source.name}:</b> {source.how}</AiNote>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
            className="card border-2 border-dashed p-8 text-center hover:border-brand/50 transition"
          >
            <div className="mx-auto h-14 w-14 rounded-2xl grid place-items-center text-white shadow-glow" style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1 55%,#22d3ee)' }}>{reading ? <Loader2 className="animate-spin" /> : <Upload />}</div>
            <div className="font-medium mt-4">Arrastra aquí todo lo exportado</div>
            <div className="text-sm text-muted mt-1">Excel, CSV, PDFs, fotos de documentos o carpetas enteras (una por empleado). Aura detecta qué es cada cosa.</div>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              <button className="btn-primary" onClick={() => fileInput.current?.click()}><FileSpreadsheet size={15} /> Elegir archivos</button>
              <button className="btn-outline" onClick={() => dirInput.current?.click()}><FolderOpen size={15} /> Elegir carpeta</button>
            </div>
            <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
            <input ref={dirInput} type="file" multiple className="hidden" {...({ webkitdirectory: '' } as Record<string, string>)} onChange={(e) => e.target.files && addFiles(e.target.files)} />
          </div>
          {(sheets.length > 0 || docs.length > 0 || backup) && (
            <Section title="Detectado">
              <div className="space-y-2">
                {backup && <div className="flex items-center gap-2 text-sm"><Sparkles size={14} className="text-brand" /> Copia completa de Aura · {Object.keys(backup).length} secciones</div>}
                {sheets.map((sh, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <FileSpreadsheet size={15} className="text-ok" />
                    <span className="truncate">{sh.file}{sh.name !== 'Sheet1' && sh.name !== sh.file ? ` · ${sh.name}` : ''}</span>
                    <span className="text-muted">· {sh.rows.length} filas</span>
                    <span className={cx('chip ml-auto', sh.kind === 'ignore' ? 'bg-sunken text-muted' : 'bg-brand/10 text-brand')}>{KIND_ICON[sh.kind]} {KIND_LABEL[sh.kind]}</span>
                  </div>
                ))}
                {docs.length > 0 && <div className="flex items-center gap-2 text-sm"><FileText size={15} className="text-brand" /> {docs.length} documentos · {counts.docsOk} asignados automáticamente</div>}
              </div>
              <div className="flex justify-between mt-5">
                <button className="btn-ghost" onClick={() => setStep('source')}><ArrowLeft size={15} /> Origen</button>
                <button className="btn-brand" onClick={() => setStep('review')}>Revisar <ArrowRight size={15} /></button>
              </div>
            </Section>
          )}
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-4 gap-4">
            {[['Personas', counts.employees, <Users2 size={15} key="u" />], ['Fichajes (filas)', counts.punches, <Timer size={15} key="t" />], ['Ausencias', counts.absences, <CalendarDays size={15} key="c" />], ['Documentos', `${counts.docsOk}/${counts.docs}`, <FileText size={15} key="d" />]].map(([l, v, ic]) => (
              <div key={l as string} className="card p-4 flex items-center gap-3"><span className="h-9 w-9 rounded-xl bg-brand/10 text-brand grid place-items-center">{ic}</span><div><div className="kpi text-xl">{v as React.ReactNode}</div><div className="text-xs text-muted">{l as string}</div></div></div>
            ))}
          </div>

          {sheets.length > 0 && (
            <section className="card overflow-hidden">
              <div className="flex gap-1 p-2 border-b border-line overflow-x-auto">
                {sheets.map((sh, i) => (
                  <button key={i} onClick={() => setActive(i)} className={cx('h-8 px-3 rounded-lg text-sm whitespace-nowrap flex items-center gap-1.5', active === i ? 'bg-sunken font-medium' : 'text-muted')}>{KIND_ICON[sh.kind]} {sh.file.replace(/\.[a-z]+$/i, '')}{sheets.filter((x) => x.file === sh.file).length > 1 ? ` · ${sh.name}` : ''}</button>
                ))}
              </div>
              {sheets[active] && <SheetEditor sheet={sheets[active]} onChange={(x) => setSheets(sheets.map((y, i) => (i === active ? x : y)))} employees={projected} />}
            </section>
          )}

          {docsMatched.length > 0 && (
            <Section title={`Documentos (${docsMatched.length})`} icon={<FileText size={15} />}>
              <div className="max-h-[360px] overflow-auto -mx-2">
                {docsMatched.map((d, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-line last:border-0 text-sm">
                    <FileText size={14} className="text-muted shrink-0" />
                    <span className="flex-1 min-w-[180px] truncate" title={d.path}>{d.path}</span>
                    <select className="input h-8 w-auto text-xs" value={d.category} onChange={(e) => setDocs(docs.map((x) => (x.path === d.path ? { ...x, category: e.target.value as DocCategory } : x)))} aria-label="Carpeta">{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <select className={cx('input h-8 w-48 text-xs', !d.empId && 'border-warn')} value={d.empId} onChange={(e) => setDocs(docs.map((x) => (x.path === d.path ? { ...x, empId: e.target.value } : x)))} aria-label="Persona">
                      <option value="">— Sin asignar —</option>
                      <option value="empresa">Toda la empresa</option>
                      {projected.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </Section>
          )}
          <div className="flex justify-between">
            <button className="btn-ghost" onClick={() => setStep('files')}><ArrowLeft size={15} /> Añadir más</button>
            <button className="btn-brand h-11 px-6" onClick={run} disabled={!sheets.some((x) => x.kind !== 'ignore') && !counts.docsOk && !backup}>Importar ahora <ArrowRight size={15} /></button>
          </div>
        </div>
      )}

      {step === 'running' && (
        <div className="card p-10 text-center">
          <Loader2 className="mx-auto animate-spin text-brand" size={32} />
          <div className="font-medium mt-4">{progress.label || 'Preparando'}…</div>
          <div className="h-2 max-w-md mx-auto rounded-full bg-sunken mt-4 overflow-hidden"><motion.div className="h-full bg-brand" animate={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 5}%` }} /></div>
          <div className="text-xs text-muted mt-2">{progress.total ? `${progress.done} de ${progress.total}` : ''}</div>
        </div>
      )}

      {step === 'done' && report && (
        <div className="space-y-5">
          <div className="card p-8 text-center aurora-border">
            <PartyPopper className="mx-auto text-brand" size={32} />
            <div className="text-xl font-semibold mt-3">Importación completada</div>
            <div className="flex flex-wrap justify-center gap-6 mt-5 text-sm">
              <div><div className="kpi">{report.employees}</div><div className="text-muted">personas nuevas</div></div>
              <div><div className="kpi">{report.updated}</div><div className="text-muted">actualizadas</div></div>
              <div><div className="kpi">{report.punches}</div><div className="text-muted">fichajes sellados</div></div>
              <div><div className="kpi">{report.absences}</div><div className="text-muted">ausencias</div></div>
              <div><div className="kpi">{report.documents}</div><div className="text-muted">documentos</div></div>
            </div>
            <div className="flex justify-center gap-2 mt-6">
              <button className="btn-primary" onClick={() => go('people')}>Ver plantilla</button>
              <button className="btn-outline" onClick={() => go('documents')}>Ver documentos</button>
              <button className="btn-ghost" onClick={() => { setSheets([]); setDocs([]); setBackup(null); setStep('source') }}>Importar más</button>
            </div>
          </div>
          {report.skipped.length > 0 && (
            <Section title={`${report.skipped.length} elementos no importados`} icon={<AlertTriangle size={15} className="text-warn" />}>
              <ul className="text-sm text-muted space-y-1 max-h-60 overflow-auto">{report.skipped.slice(0, 200).map((x, i) => <li key={i}>• {x}</li>)}</ul>
            </Section>
          )}
          <AiNote>Los fichajes importados quedan sellados en el registro con la marca «importado» y su origen, conservando la fecha y hora originales. Así se distinguen siempre de los registrados en Aura.</AiNote>
        </div>
      )}
    </div>
  )
}

function Steps({ step }: { step: string }) {
  const steps = [['source', 'Origen'], ['files', 'Archivos'], ['review', 'Revisión'], ['done', 'Listo']]
  const idx = steps.findIndex(([k]) => k === (step === 'running' ? 'done' : step))
  return (
    <div className="flex items-center gap-2 mb-6 text-sm">
      {steps.map(([k, l], i) => (
        <div key={k} className="flex items-center gap-2">
          <span className={cx('h-6 w-6 rounded-full grid place-items-center text-xs font-semibold', i < idx ? 'bg-ok text-white' : i === idx ? 'bg-brand text-white' : 'bg-sunken text-muted')}>{i < idx ? <Check size={12} /> : i + 1}</span>
          <span className={cx(i === idx ? 'font-medium' : 'text-muted')}>{l}</span>
          {i < steps.length - 1 && <span className="w-8 h-px bg-line" />}
        </div>
      ))}
    </div>
  )
}

function SheetEditor({ sheet, onChange, employees }: { sheet: SheetState; onChange: (s: SheetState) => void; employees: Employee[] }) {
  const match = useMemo(() => makeMatcher(employees), [employees])
  const fields = sheet.kind === 'ignore' ? [] : FIELDS[sheet.kind]
  const preview = sheet.rows.slice(0, 6)
  const unmatched = sheet.kind === 'punches' || sheet.kind === 'absences' ? sheet.rows.filter((r) => !match(r[sheet.map.employee])).length : 0
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm text-muted">Contiene:</span>
        {(['employees', 'punches', 'absences', 'ignore'] as Kind[]).map((k) => (
          <button key={k} onClick={() => onChange({ ...sheet, kind: k, map: k === 'ignore' ? {} : autoMap(k as Exclude<Kind, 'ignore'>, sheet.headers) })} className={cx('chip h-8 px-3 border text-xs', sheet.kind === k ? 'bg-brand text-white border-transparent' : 'border-line bg-surface text-ink')}>{KIND_ICON[k]} {KIND_LABEL[k]}</button>
        ))}
        <span className="text-xs text-muted ml-auto">{sheet.rows.length} filas</span>
      </div>
      {sheet.kind !== 'ignore' && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="label flex items-center gap-1">{f.label}{f.required && <span className="text-bad">*</span>}{sheet.map[f.key] && <Check size={11} className="text-ok" />}</label>
                <select className="input h-9 text-xs" value={sheet.map[f.key] ?? ''} onChange={(e) => onChange({ ...sheet, map: { ...sheet.map, [f.key]: e.target.value } })}>
                  <option value="">— No usar —</option>
                  {sheet.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          {unmatched > 0 && <div className="text-sm text-warn mt-3 flex items-center gap-1.5"><AlertTriangle size={14} /> {unmatched} filas con personas que no están en la plantilla: impórtala en el mismo paso o revisa los nombres.</div>}
          <div className="overflow-x-auto mt-4 rounded-xl border border-line">
            <table className="w-full text-xs">
              <thead><tr className="bg-sunken/60 text-muted">{fields.filter((f) => sheet.map[f.key]).map((f) => <th key={f.key} className="text-left font-medium px-3 h-8 whitespace-nowrap">{f.label}</th>)}{sheet.kind !== 'employees' && <th className="text-left font-medium px-3">Persona en Aura</th>}</tr></thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {fields.filter((f) => sheet.map[f.key]).map((f) => <td key={f.key} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate">{fmtCell(r[sheet.map[f.key]], f.key)}</td>)}
                    {sheet.kind !== 'employees' && <td className="px-3">{(() => { const e = match(r[sheet.map.employee]); return e ? <span className="inline-flex items-center gap-1.5"><Avatar emp={e} size={18} /> {e.name}</span> : <span className="text-bad">No encontrada</span> })()}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function fmtCell(v: unknown, key: string) {
  if (['date', 'from', 'to', 'hiredAt', 'birthday', 'datetime'].includes(key)) {
    const d = parseDate(v)
    return d ? d.toLocaleDateString('es-ES') + (key === 'datetime' ? ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '') : <span className="text-bad">{String(v ?? '')}</span>
  }
  if (key === 'in' || key === 'out') {
    const m = parseTime(v)
    return m == null ? <span className="text-muted">{String(v ?? '—')}</span> : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  }
  if (key === 'type' && v != null) return `${String(v)} → ${absenceType(v)}`
  return String(v ?? '')
}

function blankEmp(): Employee {
  const s = useStore.getState()
  return { id: uid('e_'), name: '', role: '', team: 'General', managerId: s.meId, zoneId: s.zones[0]?.id ?? '', hue: Math.floor(Math.random() * 360), salary: 0, pagas: 14, contract: 'indefinido', weeklyHours: 40, start: '09:00', end: '18:00', breakMin: 60, remoteDays: [], pin: String(1000 + Math.floor(Math.random() * 9000)), birthday: '', hiredAt: dayKey(new Date()), children: 0 }
}

/** Restaura una copia completa de Aura (mismo formato que «Exportar copia completa»). */
async function restoreBackup(b: Record<string, unknown>, rep: Report, setProgress: (p: { done: number; total: number; label: string }) => void) {
  const s = useStore.getState()
  const mergeById = <T extends { id: string }>(cur: T[], inc: T[] = []) => [...cur.filter((x) => !inc.some((y) => y.id === x.id)), ...inc]
  const emps = (b.employees as Employee[]) ?? []
  for (const e of emps) s.upsertEmployee(e)
  rep.employees += emps.length
  useStore.setState({
    zones: mergeById(useStore.getState().zones, b.zones as never),
    requests: mergeById(useStore.getState().requests, b.requests as never),
    expenses: mergeById(useStore.getState().expenses, b.expenses as never),
    shifts: mergeById(useStore.getState().shifts, b.shifts as never),
    documents: mergeById(useStore.getState().documents, b.documents as never),
  })
  rep.absences += ((b.requests as unknown[]) ?? []).length
  rep.documents += ((b.documents as unknown[]) ?? []).length
  const punches = ((b.punches as Punch[]) ?? []).filter((p) => !useStore.getState().punches.some((x) => x.id === p.id))
  if (punches.length) {
    setProgress({ done: 0, total: punches.length, label: 'Sellando fichajes de la copia' })
    rep.punches += await useStore.getState().importPunches(punches.map((p) => ({ ...p, method: 'import', flags: [...p.flags.filter((f) => f !== 'importado'), 'importado'], note: p.note ?? `Copia de Aura (asiento original #${p.seq})` })))
  }
}
