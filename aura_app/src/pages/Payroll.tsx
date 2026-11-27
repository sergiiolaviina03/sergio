import { Wallet, Download, TrendingUp, Building2, Sparkles, Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { endOfMonth, startOfMonth, subMonths } from 'date-fns'
import { useMe, useStore } from '../store'
import { annualNet, companySSRate, eur, irpfRate, payslip, workerSSRate, type Line } from '../lib/payroll'
import { byDay, rangeStats } from '../lib/attendance'
import { cap, fmt, monthKey } from '../lib/time'
import { AiNote, Avatar, PageHeader, Section, Tabs, cx, toast } from '../components/ui'
import { saveFile } from '../lib/platform'
import { payslipPdf } from '../lib/pdf'
import type { Employee } from '../types'

export function PayrollPage() {
  const s = useStore()
  const manager = s.settings.viewAs === 'manager'
  const [tab, setTab] = useState<'slip' | 'sim' | 'team'>('slip')
  return (
    <div>
      <PageHeader
        icon={<Wallet size={19} />}
        title="Nóminas"
        subtitle="Calculadas automáticamente a partir de tus fichajes y ausencias"
        tabs={<Tabs value={tab} onChange={setTab} items={[{ id: 'slip', label: 'Mi nómina' }, { id: 'sim', label: 'Simulador' }, ...(manager ? [{ id: 'team' as const, label: 'Coste de equipo' }] : [])]} />}
      />
      {tab === 'slip' && <MySlip />}
      {tab === 'sim' && <Simulator />}
      {tab === 'team' && <TeamCost />}
    </div>
  )
}

function useOvertime(emp: Employee, month: Date) {
  const punches = useStore((s) => s.punches)
  const reqs = useStore((s) => s.requests)
  return useMemo(() => {
    const st = rangeStats(emp, byDay(punches, emp.id), reqs, startOfMonth(month), endOfMonth(month))
    // Franquicia de 60 min/mes para no pagar «minutos sueltos»; el resto se liquida como extra
    return Math.max(0, Math.round(st.overtime - 60))
  }, [punches, reqs, emp, month])
}

function MySlip() {
  const me = useMe()
  const months = Array.from({ length: 12 }, (_, i) => startOfMonth(subMonths(new Date(), i)))
  const [sel, setSel] = useState(0)
  const month = months[sel]
  const ot = useOvertime(me, month)
  const company = useStore((s) => s.company)
  const expenses = useStore((s) => s.expenses)
  const reimburse = sel === 0 ? expenses.filter((x) => x.empId === me.id && x.status === 'approved').reduce((a, x) => a + x.amount, 0) : 0
  const p = payslip(me, monthKey(month), { overtimeMin: ot, reimburse })
  const prev = payslip(me, monthKey(months[sel + 1] ?? month), {})
  const segs = [
    { label: 'Neto', v: p.neto, c: '#6366f1' },
    { label: 'IRPF', v: p.deducciones.find((d) => d.concept.includes('IRPF'))!.amount, c: '#a855f7' },
    { label: 'S. Social (tú)', v: p.deducciones.filter((d) => !d.concept.includes('IRPF')).reduce((a, d) => a + d.amount, 0), c: '#22d3ee' },
    { label: 'S. Social (empresa)', v: p.coste - p.bruto, c: 'rgb(var(--line))' },
  ]
  return (
    <div className="grid xl:grid-cols-[220px_1fr_300px] gap-5">
      <div className="card p-2 h-fit max-xl:flex max-xl:overflow-auto">
        {months.map((m, i) => {
          const x = payslip(me, monthKey(m))
          return (
            <button key={i} onClick={() => setSel(i)} className={cx('w-full max-xl:w-auto max-xl:shrink-0 flex items-center justify-between gap-4 px-3 h-11 rounded-xl text-sm transition', sel === i ? 'bg-sunken font-medium' : 'hover:bg-sunken/60 text-muted')}>
              <span>{cap(fmt(m, 'MMMM yy'))}</span>
              <span className="tabular-nums text-xs">{i === 0 ? <span className="chip bg-warn/10 text-warn">previsión</span> : eur(x.neto, 0)}</span>
            </button>
          )
        })}
      </div>

      <section className="card p-0 overflow-hidden print-area">
        <div className="p-6 border-b border-line flex flex-wrap gap-4 items-start">
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs text-muted uppercase tracking-wider">Recibo de salarios</div>
            <div className="text-xl font-semibold mt-1">{cap(fmt(month, 'MMMM yyyy'))}</div>
            <div className="text-xs text-muted mt-1">{company.legal} · CIF {company.cif} · CCC {company.ccc}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">{me.name}</div>
            <div className="text-xs text-muted">{me.role} · {me.contract === 'indefinido' ? 'Indefinido' : 'Temporal'} · {me.pagas} pagas</div>
            <button onClick={async () => { const ok = await saveFile(`nomina-${monthKey(month)}.pdf`, payslipPdf(me, p, cap(fmt(month, 'MMMM yyyy')))); toast(ok ? { title: 'Nómina descargada' } : { title: 'No se pudo descargar', tone: 'warn' }) }} className="btn-outline h-8 mt-2"><Download size={14} /> Descargar PDF</button>
          </div>
        </div>
        <div className="p-6 grid md:grid-cols-2 gap-6">
          <Lines title="Devengos" lines={p.devengos} total={p.devengos.reduce((a, l) => a + l.amount, 0)} />
          <Lines title="Deducciones" lines={p.deducciones} total={p.deducciones.reduce((a, l) => a + l.amount, 0)} negative />
        </div>
        <div className="mx-6 mb-6 rounded-2xl p-5 flex flex-wrap items-center gap-4 text-white" style={{ background: 'linear-gradient(120deg,#7c3aed,#6366f1 55%,#06b6d4)' }}>
          <div className="flex-1">
            <div className="text-xs opacity-80">Líquido a percibir</div>
            <motion.div key={p.neto} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-semibold tabular-nums tracking-tight">{eur(p.neto)}</motion.div>
          </div>
          <div className="text-right text-xs opacity-90 space-y-0.5">
            <div>Bruto {eur(p.bruto)}</div>
            <div>Base CC {eur(p.baseCC)} · IRPF {p.irpf}%</div>
          </div>
        </div>
        <details className="px-6 pb-6 text-sm">
          <summary className="cursor-pointer text-muted hover:text-ink">Aportación de la empresa · coste total {eur(p.coste)}</summary>
          <div className="mt-3"><Lines title="" lines={p.empresa} total={p.coste - p.bruto} /></div>
        </details>
      </section>

      <div className="space-y-5">
        <Section title="¿A dónde va tu sueldo?">
          <div className="flex h-3 rounded-full overflow-hidden">
            {segs.map((x) => <div key={x.label} style={{ width: `${(x.v / p.coste) * 100}%`, background: x.c }} />)}
          </div>
          <div className="mt-4 space-y-2">
            {segs.map((x) => (
              <div key={x.label} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.c }} />
                <span className="flex-1 text-muted">{x.label}</span>
                <span className="tabular-nums font-medium">{eur(x.v, 0)}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted mt-3">Por cada 100 € que cuestas a la empresa, recibes {Math.round((p.neto / p.coste) * 100)} € netos.</div>
        </Section>
        <AiNote>
          {ot > 0 ? <>Este mes se liquidan <b>{(ot / 60).toFixed(1)} h extra</b> detectadas en tu hoja de horas (+{eur(p.devengos.find((d) => d.concept.startsWith('Horas'))?.amount ?? 0)}).</> : <>No hay horas extra este mes.</>}{' '}
          {p.neto > prev.neto + 5 ? `Cobras ${eur(p.neto - prev.neto, 0)} más que el mes anterior.` : p.neto < prev.neto - 5 ? `Cobras ${eur(prev.neto - p.neto, 0)} menos que el mes anterior${Number(monthKey(months[sel + 1] ?? month).slice(5)) % 6 === 0 ? ' (el anterior incluía paga extra)' : ''}.` : 'Igual que el mes anterior.'}
        </AiNote>
        <div className="text-[11px] text-muted flex gap-1.5"><Info size={12} className="shrink-0 mt-0.5" /> Estimación con tipos de cotización 2026 y escala IRPF general. La nómina oficial la valida tu asesoría.</div>
      </div>
    </div>
  )
}

function Lines({ title, lines, total, negative }: { title: string; lines: Line[]; total: number; negative?: boolean }) {
  return (
    <div>
      {title && <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{title}</div>}
      <div className="space-y-1.5">
        {lines.map((l) => (
          <div key={l.concept} className="flex items-baseline gap-2 text-sm">
            <span className="flex-1">
              {l.concept}
              {l.rate != null && <span className="text-xs text-muted"> · {l.rate}%</span>}
              {l.hint && <span className="block text-[11px] text-muted">{l.hint}</span>}
            </span>
            <span className={cx('tabular-nums', l.amount === 0 && 'text-muted')}>{negative && l.amount ? '−' : ''}{eur(l.amount)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm font-semibold border-t border-line mt-3 pt-2">
        <span>Total</span>
        <span className="tabular-nums">{negative ? '−' : ''}{eur(total)}</span>
      </div>
    </div>
  )
}

function Simulator() {
  const me = useMe()
  const [salary, setSalary] = useState(me.salary)
  const [children, setChildren] = useState(me.children)
  const [pagas, setPagas] = useState<12 | 14>(me.pagas)
  const [contract, setContract] = useState(me.contract)
  const emp = { ...me, salary, children, pagas, contract }
  const now = annualNet(me, me.salary)
  const sim = annualNet(emp, salary)
  const rate = irpfRate(salary, children, contract)
  const marg = annualNet(emp, salary + 1000).neto - sim.neto
  const curve = Array.from({ length: 30 }, (_, i) => {
    const g = 15000 + i * 3500
    const a = annualNet(emp, g)
    return { g, n: a.neto, c: a.coste }
  })
  const maxC = curve.at(-1)!.c
  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-5">
      <Section title="Parámetros" icon={<TrendingUp size={15} />}>
        <label className="label">Salario bruto anual</label>
        <div className="flex items-baseline gap-2 mb-2">
          <input type="number" step={500} className="input h-12 text-2xl font-semibold tabular-nums w-48" value={salary} onChange={(e) => setSalary(Math.max(0, +e.target.value))} />
          {salary !== me.salary && <span className={cx('chip', salary > me.salary ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad')}>{salary > me.salary ? '+' : ''}{eur(salary - me.salary, 0)} vs actual</span>}
        </div>
        <input type="range" min={15000} max={120000} step={500} value={salary} onChange={(e) => setSalary(+e.target.value)} className="w-full accent-[rgb(var(--brand))]" />
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div><label className="label">Hijos</label><input type="number" min={0} max={6} className="input" value={children} onChange={(e) => setChildren(+e.target.value)} /></div>
          <div><label className="label">Pagas</label><select className="input" value={pagas} onChange={(e) => setPagas(+e.target.value as 12 | 14)}><option value={14}>14</option><option value={12}>12</option></select></div>
          <div><label className="label">Contrato</label><select className="input" value={contract} onChange={(e) => setContract(e.target.value as Employee['contract'])}><option value="indefinido">Indefinido</option><option value="temporal">Temporal</option></select></div>
        </div>
        <div className="mt-6">
          <div className="text-xs text-muted mb-2">Neto vs coste empresa según bruto</div>
          <svg viewBox="0 0 300 120" className="w-full h-36">
            <polyline fill="none" stroke="rgb(var(--line))" strokeWidth={2} points={curve.map((p, i) => `${(i / 29) * 300},${120 - (p.c / maxC) * 110}`).join(' ')} />
            <polyline fill="none" stroke="#6366f1" strokeWidth={2.5} points={curve.map((p, i) => `${(i / 29) * 300},${120 - (p.n / maxC) * 110}`).join(' ')} />
            <circle cx={Math.min(300, ((salary - 15000) / (29 * 3500)) * 300)} cy={120 - (sim.neto / maxC) * 110} r={5} fill="#6366f1" stroke="white" strokeWidth={2} />
          </svg>
        </div>
      </Section>
      <div className="space-y-5">
        <section className="card p-6 aurora-border">
          <div className="text-xs text-muted">Neto mensual medio</div>
          <motion.div key={Math.round(sim.neto)} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="text-4xl font-semibold tabular-nums tracking-tight mt-1">{eur(sim.neto / 12, 0)}</motion.div>
          <div className="text-sm text-muted mt-1">{pagas === 14 ? `${eur(payslip(emp, '2026-03').neto, 0)} × 12 + 2 pagas extra` : '12 pagas con extras prorrateadas'}</div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div><div className="text-xs text-muted">Neto anual</div><div className="font-semibold tabular-nums">{eur(sim.neto, 0)}</div></div>
            <div><div className="text-xs text-muted">IRPF</div><div className="font-semibold tabular-nums">{rate}%</div></div>
            <div><div className="text-xs text-muted">Coste empresa</div><div className="font-semibold tabular-nums">{eur(sim.coste, 0)}</div></div>
          </div>
        </section>
        <AiNote>
          De cada 1.000 € brutos más, te llegan <b>{eur(marg, 0)}</b> netos. {salary !== me.salary && <>Respecto a tu salario actual, ganarías <b>{eur((sim.neto - now.neto) / 12, 0)}/mes</b> {sim.neto > now.neto ? 'más' : 'menos'}.</>} Seguridad Social: {workerSSRate(contract).toFixed(2)}% a tu cargo y {companySSRate(contract).toFixed(2)}% a cargo de la empresa.
        </AiNote>
        <Section title="Ideas para ganar más neto" icon={<Sparkles size={15} />}>
          <ul className="text-sm space-y-2 text-muted">
            <li>🍽️ <b className="text-ink">Ticket restaurante</b>: exento hasta 11 €/día laborable (~2.400 €/año).</li>
            <li>🚇 <b className="text-ink">Transporte</b>: exento hasta 1.500 €/año.</li>
            <li>🩺 <b className="text-ink">Seguro médico</b>: exento hasta 500 €/persona/año.</li>
            <li>🎓 <b className="text-ink">Formación</b> relacionada con tu puesto: exenta.</li>
          </ul>
        </Section>
      </div>
    </div>
  )
}

function TeamCost() {
  const s = useStore()
  const month = startOfMonth(new Date())
  const rows = s.employees.map((e) => {
    const st = rangeStats(e, byDay(s.punches, e.id), s.requests, startOfMonth(subMonths(month, 1)), endOfMonth(subMonths(month, 1)))
    const ot = Math.max(0, Math.round(st.overtime - 60))
    const p = payslip(e, monthKey(subMonths(month, 1)), { overtimeMin: ot })
    return { e, p, ot }
  })
  const tot = rows.reduce((a, r) => ({ bruto: a.bruto + r.p.bruto, neto: a.neto + r.p.neto, coste: a.coste + r.p.coste, ot: a.ot + (r.p.devengos.find((d) => d.concept.startsWith('Horas'))?.amount ?? 0) }), { bruto: 0, neto: 0, coste: 0, ot: 0 })
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-4 gap-4">
        {[['Coste total', tot.coste], ['Bruto', tot.bruto], ['Neto pagado', tot.neto], ['Horas extra', tot.ot]].map(([l, v]) => (
          <div key={l as string} className="card p-4"><div className="text-xs text-muted">{l} · {fmt(subMonths(month, 1), 'MMM')}</div><div className="kpi mt-1">{eur(v as number, 0)}</div></div>
        ))}
      </div>
      <section className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-xs text-muted text-left border-b border-line bg-sunken/50">
              <th className="font-medium px-4 h-10">Persona</th><th className="font-medium">Bruto anual</th><th className="font-medium">H. extra</th><th className="font-medium text-right">Bruto mes</th><th className="font-medium text-right">Neto</th><th className="font-medium text-right px-4">Coste empresa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, p, ot }) => (
              <tr key={e.id} className="border-b border-line last:border-0 hover:bg-sunken/50">
                <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><Avatar emp={e} size={28} /><div><div className="font-medium">{e.name}</div><div className="text-xs text-muted">{e.role}</div></div></div></td>
                <td className="tabular-nums">{eur(e.salary, 0)}</td>
                <td>{ot ? <span className="chip bg-brand/10 text-brand">{(ot / 60).toFixed(1)} h</span> : <span className="text-muted">—</span>}</td>
                <td className="text-right tabular-nums">{eur(p.bruto)}</td>
                <td className="text-right tabular-nums">{eur(p.neto)}</td>
                <td className="text-right tabular-nums px-4 font-medium">{eur(p.coste)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <AiNote><Building2 size={14} className="inline mr-1" /> Las horas extra salen directamente del registro de jornada sellado: lo que se paga es exactamente lo que se fichó, con trazabilidad completa.</AiNote>
    </div>
  )
}
