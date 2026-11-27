import { Users2, Plus, Search, Pencil, Trash2, Building2, Network, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Employee } from '../types'
import { Avatar, Modal, PageHeader, Section, Tabs, cx, toast } from '../components/ui'
import { eur } from '../lib/payroll'
import { uid } from '../lib/rng'
import { saveFile } from '../lib/platform'
import { dayKey, fmt, parseDay } from '../lib/time'
import { cloud, createInvite, type Role } from '../lib/cloud'
import { Send, Copy } from 'lucide-react'

const DAYS = ['L', 'M', 'X', 'J', 'V']

export function PeoplePage() {
  const s = useStore()
  const [tab, setTab] = useState<'list' | 'org' | 'company'>('list')
  const [q, setQ] = useState('')
  const [team, setTeam] = useState('all')
  const [edit, setEdit] = useState<Employee | null>(null)
  const teams = [...new Set(s.employees.map((e) => e.team))]
  const list = s.employees.filter((e) => (team === 'all' || e.team === team) && (e.name + e.role).toLowerCase().includes(q.toLowerCase()))
  const blank = (): Employee => ({ id: uid('e_'), name: '', role: '', team: teams[0] ?? 'General', managerId: s.meId, zoneId: s.zones[0]?.id ?? '', hue: Math.floor(Math.random() * 360), salary: 30000, pagas: 14, contract: 'indefinido', weeklyHours: 40, start: '09:00', end: '18:00', breakMin: 60, remoteDays: [], pin: String(Math.floor(1000 + Math.random() * 9000)), birthday: '', hiredAt: dayKey(new Date()), children: 0 })

  const exportCsv = () => {
    const rows = [['Nombre', 'Puesto', 'Equipo', 'Responsable', 'Centro', 'Contrato', 'Jornada', 'Horario', 'Teletrabajo', 'Alta', 'Salario bruto'], ...s.employees.map((e) => [e.name, e.role, e.team, s.employees.find((m) => m.id === e.managerId)?.name ?? '', s.zones.find((z) => z.id === e.zoneId)?.name ?? '', e.contract, `${e.weeklyHours} h`, `${e.start}-${e.end}`, e.remoteDays.map((d) => DAYS[d - 1]).join(''), e.hiredAt, e.salary])]
    saveFile('plantilla.csv', '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv')
  }

  return (
    <div>
      <PageHeader
        icon={<Users2 size={19} />}
        title="Personas"
        subtitle={`${s.employees.length} personas · ${teams.length} equipos · ${s.zones.length} centros`}
        actions={<><button className="btn-outline" onClick={exportCsv}><Download size={15} /> Exportar</button><button className="btn-brand" onClick={() => setEdit(blank())}><Plus size={15} /> Añadir persona</button></>}
        tabs={<Tabs value={tab} onChange={setTab} items={[{ id: 'list', label: 'Plantilla' }, { id: 'org', label: 'Organigrama' }, { id: 'company', label: 'Empresa' }]} />}
      />
      {tab === 'list' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-surface border border-line flex-1 min-w-[200px] max-w-sm">
              <Search size={15} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o puesto" className="bg-transparent outline-none text-sm flex-1" />
            </div>
            <select className="input w-auto" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Equipo">
              <option value="all">Todos los equipos</option>
              {teams.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <section className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-xs text-muted text-left border-b border-line bg-sunken/50">
                  <th className="font-medium px-4 h-10">Persona</th><th className="font-medium">Equipo</th><th className="font-medium">Centro</th><th className="font-medium">Horario</th><th className="font-medium">Teletrabajo</th><th className="font-medium">Contrato</th><th className="font-medium text-right">Bruto anual</th><th className="w-40" />
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0 hover:bg-sunken/40 group">
                    <td className="px-4 py-2.5"><div className="flex items-center gap-3"><Avatar emp={e} size={32} /><div><div className="font-medium">{e.name}</div><div className="text-xs text-muted">{e.role}</div></div></div></td>
                    <td>{e.team}</td>
                    <td className="text-muted">{s.zones.find((z) => z.id === e.zoneId)?.name ?? '—'}</td>
                    <td className="tabular-nums">{e.start}–{e.end}</td>
                    <td><div className="flex gap-0.5">{DAYS.map((d, i) => <span key={d} className={cx('h-5 w-5 rounded text-[10px] grid place-items-center', e.remoteDays.includes(i + 1) ? 'bg-ok/15 text-ok font-semibold' : 'bg-sunken text-muted')}>{d}</span>)}</div></td>
                    <td><span className={cx('chip', e.contract === 'indefinido' ? 'bg-brand/10 text-brand' : 'bg-warn/10 text-warn')}>{e.contract}</span></td>
                    <td className="text-right tabular-nums">{eur(e.salary, 0)}</td>
                    <td className="pr-3 text-right whitespace-nowrap"><InviteCell emp={e} /><button className="btn-ghost h-8 w-8 px-0 opacity-0 group-hover:opacity-100" onClick={() => setEdit(e)} aria-label="Editar"><Pencil size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
      {tab === 'org' && <OrgChart onPick={setEdit} />}
      {tab === 'company' && <CompanyForm />}
      <EmployeeForm emp={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function InviteCell({ emp }: { emp: Employee }) {
  const c = cloud()
  const [inv, setInv] = useState<{ code: string; link: string }>()
  const [role, setRole] = useState<Role>('employee')
  if (c.status !== 'ready') return null
  if (c.members.some((m) => m.employee_id === emp.id)) return <span className="chip bg-ok/10 text-ok mr-1">Con acceso</span>
  const make = async () => {
    try {
      const r = await createInvite(emp.id, role)
      setInv(r)
    } catch (e) {
      toast({ title: 'No se pudo crear la invitación', body: (e as Error).message, tone: 'bad' })
    }
  }
  const copy = async () => {
    const text = `Hola ${emp.name.split(' ')[0]}, te invito a Aura para fichar y gestionar tus ausencias y documentos. Entra aquí: ${inv!.link} (código ${inv!.code})`
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: 'Invitación copiada', body: 'Pégala en un email o WhatsApp.' })
    } catch {
      toast({ title: `Código: ${inv!.code}`, body: inv!.link })
    }
  }
  return inv ? (
    <button className="chip h-7 px-2.5 bg-brand/10 text-brand mr-1 font-mono" onClick={copy} title={inv.link}><Copy size={11} /> {inv.code}</button>
  ) : (
    <span className="inline-flex items-center gap-1 mr-1">
      {c.role === 'admin' && <select className="input h-7 w-auto text-[11px] py-0" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Rol"><option value="employee">Empleado</option><option value="manager">Responsable</option><option value="admin">Admin</option></select>}
      <button className="chip h-7 px-2.5 bg-sunken border border-line text-ink hover:bg-brand/10" onClick={make}><Send size={11} /> Invitar</button>
    </span>
  )
}

function OrgChart({ onPick }: { onPick: (e: Employee) => void }) {
  const emps = useStore((s) => s.employees)
  const roots = emps.filter((e) => !e.managerId || !emps.some((m) => m.id === e.managerId))
  const Card = ({ e, small }: { e: Employee; small?: boolean }) => (
    <button onClick={() => onPick(e)} className={cx('card flex items-center gap-2.5 hover:shadow-pop transition text-left w-full', small ? 'px-2.5 py-2' : 'px-3 py-2.5')}>
      <Avatar emp={e} size={small ? 28 : 36} />
      <div className="min-w-0"><div className="text-sm font-medium truncate">{e.name}</div><div className="text-[11px] text-muted truncate">{e.role}</div></div>
      {emps.some((x) => x.managerId === e.id) && <span className="chip bg-sunken text-muted ml-auto">{emps.filter((x) => x.managerId === e.id).length}</span>}
    </button>
  )
  return (
    <section className="card p-6">
      <div className="flex items-center gap-2 text-sm text-muted mb-6"><Network size={15} /> Pulsa una persona para editarla</div>
      {roots.map((r) => {
        const kids = emps.filter((x) => x.managerId === r.id)
        const byTeam = [...new Set(kids.map((k) => k.team))].map((t) => ({ t, people: kids.filter((k) => k.team === t) }))
        return (
          <div key={r.id} className="flex flex-col items-center mb-8 last:mb-0">
            <div className="w-[240px]"><Card e={r} /></div>
            {!!kids.length && <div className="w-px h-6 bg-line" />}
            {!!kids.length && <div className="h-px bg-line w-[min(100%,calc(100%-260px))]" />}
            <div className="grid gap-4 w-full mt-0" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` }}>
              {byTeam.map(({ t, people }) => (
                <div key={t} className="flex flex-col items-center">
                  <div className="w-px h-6 bg-line" />
                  <div className="w-full rounded-2xl bg-sunken/60 border border-line p-3">
                    <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2 px-1">{t} · {people.length}</div>
                    <div className="space-y-2">{people.map((p) => <Card key={p.id} e={p} small />)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}

function CompanyForm() {
  const c = useStore((s) => s.company)
  const set = useStore((s) => s.setCompany)
  const field = (k: keyof typeof c, label: string) => (
    <div><label className="label" htmlFor={`co-${k}`}>{label}</label><input id={`co-${k}`} className="input" value={c[k]} onChange={(e) => set({ [k]: e.target.value })} /></div>
  )
  return (
    <Section title="Datos de la empresa" icon={<Building2 size={15} />} className="max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-3">
        {field('name', 'Nombre comercial')}
        {field('legal', 'Razón social')}
        {field('cif', 'CIF')}
        {field('ccc', 'Código de cuenta de cotización')}
      </div>
      <div className="mt-3">{field('address', 'Domicilio social')}</div>
      <p className="text-xs text-muted mt-3">Aparecen en las nóminas, los documentos firmados y las exportaciones para la Inspección.</p>
    </Section>
  )
}

function EmployeeForm({ emp, onClose }: { emp: Employee | null; onClose: () => void }) {
  const s = useStore()
  const [f, setF] = useState<Employee | null>(emp)
  const [last, setLast] = useState(emp)
  const [confirmDel, setConfirmDel] = useState(false)
  if (emp !== last) {
    setLast(emp)
    setF(emp)
    setConfirmDel(false)
  }
  const exists = useMemo(() => !!emp && s.employees.some((x) => x.id === emp.id), [emp, s.employees])
  if (!f) return <Modal open={false} onClose={onClose}>{null}</Modal>
  const up = (p: Partial<Employee>) => setF({ ...f, ...p })
  const pinTaken = s.employees.some((x) => x.id !== f.id && x.pin === f.pin)
  const save = () => {
    s.upsertEmployee(f)
    toast({ title: exists ? 'Ficha actualizada' : `${f.name.split(' ')[0]} se ha unido al equipo`, body: exists ? undefined : `PIN de quiosco: ${f.pin}` })
    onClose()
  }
  const id = (k: string) => `emp-${k}`
  return (
    <Modal open={!!emp} onClose={onClose} wide title={exists ? f.name : 'Nueva persona'} icon={f.name ? <Avatar emp={f} size={30} /> : <Users2 size={18} className="text-brand" />}>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="label" htmlFor={id('name')}>Nombre y apellidos</label><input id={id('name')} className="input" value={f.name} onChange={(e) => up({ name: e.target.value })} /></div>
        <div><label className="label" htmlFor={id('role')}>Puesto</label><input id={id('role')} className="input" value={f.role} onChange={(e) => up({ role: e.target.value })} /></div>
        <div><label className="label" htmlFor={id('team')}>Equipo</label><input id={id('team')} className="input" list="teams" value={f.team} onChange={(e) => up({ team: e.target.value })} /><datalist id="teams">{[...new Set(s.employees.map((e) => e.team))].map((t) => <option key={t} value={t} />)}</datalist></div>
        <div><label className="label" htmlFor={id('mgr')}>Responsable</label><select id={id('mgr')} className="input" value={f.managerId ?? ''} onChange={(e) => up({ managerId: e.target.value || undefined })}><option value="">— Nadie —</option>{s.employees.filter((x) => x.id !== f.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div><label className="label" htmlFor={id('zone')}>Centro de trabajo</label><select id={id('zone')} className="input" value={f.zoneId} onChange={(e) => up({ zoneId: e.target.value })}>{s.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
        <div><label className="label" htmlFor={id('hired')}>Fecha de alta</label><input id={id('hired')} type="date" className="input" value={f.hiredAt} onChange={(e) => up({ hiredAt: e.target.value })} /></div>
      </div>
      <div className="text-xs font-semibold text-muted uppercase tracking-wider mt-6 mb-2">Jornada</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><label className="label" htmlFor={id('h')}>Horas/semana</label><input id={id('h')} type="number" className="input" value={f.weeklyHours} onChange={(e) => up({ weeklyHours: +e.target.value })} /></div>
        <div><label className="label" htmlFor={id('st')}>Entrada</label><input id={id('st')} type="time" className="input" value={f.start} onChange={(e) => up({ start: e.target.value })} /></div>
        <div><label className="label" htmlFor={id('en')}>Salida</label><input id={id('en')} type="time" className="input" value={f.end} onChange={(e) => up({ end: e.target.value })} /></div>
        <div><label className="label" htmlFor={id('br')}>Pausa (min)</label><input id={id('br')} type="number" className="input" value={f.breakMin} onChange={(e) => up({ breakMin: +e.target.value })} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-sm text-muted mr-1">Teletrabajo:</span>
        {DAYS.map((d, i) => (
          <button key={d} onClick={() => up({ remoteDays: f.remoteDays.includes(i + 1) ? f.remoteDays.filter((x) => x !== i + 1) : [...f.remoteDays, i + 1].sort() })} className={cx('h-8 w-8 rounded-lg text-sm font-medium border transition', f.remoteDays.includes(i + 1) ? 'bg-ok text-white border-transparent' : 'border-line hover:bg-sunken')}>{d}</button>
        ))}
      </div>
      <div className="text-xs font-semibold text-muted uppercase tracking-wider mt-6 mb-2">Contrato y nómina</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><label className="label" htmlFor={id('sal')}>Bruto anual (€)</label><input id={id('sal')} type="number" step={500} className="input" value={f.salary} onChange={(e) => up({ salary: +e.target.value })} /></div>
        <div><label className="label" htmlFor={id('pg')}>Pagas</label><select id={id('pg')} className="input" value={f.pagas} onChange={(e) => up({ pagas: +e.target.value as 12 | 14 })}><option value={14}>14</option><option value={12}>12</option></select></div>
        <div><label className="label" htmlFor={id('ct')}>Contrato</label><select id={id('ct')} className="input" value={f.contract} onChange={(e) => up({ contract: e.target.value as Employee['contract'] })}><option value="indefinido">Indefinido</option><option value="temporal">Temporal</option></select></div>
        <div><label className="label" htmlFor={id('ch')}>Hijos (IRPF)</label><input id={id('ch')} type="number" min={0} className="input" value={f.children} onChange={(e) => up({ children: +e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div><label className="label" htmlFor={id('pin')}>PIN de quiosco</label><input id={id('pin')} className={cx('input font-mono', pinTaken && 'border-bad')} maxLength={4} value={f.pin} onChange={(e) => up({ pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} />{pinTaken && <div className="text-xs text-bad mt-1">Ese PIN ya lo usa otra persona</div>}</div>
        <div><label className="label" htmlFor={id('bd')}>Cumpleaños</label><input id={id('bd')} type="date" className="input" value={f.birthday ? `2000-${f.birthday}` : ''} onChange={(e) => up({ birthday: e.target.value.slice(5) })} /></div>
      </div>
      <div className="flex items-center gap-2 mt-6">
        {exists && f.id !== s.meId && (confirmDel ? (
          <button className="btn-outline text-bad" onClick={() => { s.removeEmployee(f.id); toast({ title: `${f.name} dado de baja`, body: 'Sus registros sellados se conservan.' }); onClose() }}><Trash2 size={14} /> Confirmar baja</button>
        ) : (
          <button className="btn-ghost text-bad" onClick={() => setConfirmDel(true)}><Trash2 size={14} /> Dar de baja</button>
        ))}
        <span className="text-xs text-muted ml-auto hidden sm:block">{exists ? `En la empresa desde ${fmt(parseDay(f.hiredAt), "MMMM 'de' yyyy")}` : ''}</span>
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-brand" disabled={!f.name.trim() || !f.role.trim() || f.pin.length !== 4 || pinTaken} onClick={save}>{exists ? 'Guardar' : 'Añadir'}</button>
      </div>
    </Modal>
  )
}
