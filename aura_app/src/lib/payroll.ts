// Motor de nómina España 2026 (régimen general). Estimación orientativa: tipos de la Orden PJC/297/2026.
// Para producción, enlazar con tablas oficiales (bases por grupo, convenio, regularización de IRPF).
import type { Employee } from '../types'

export const SS_2026 = {
  maxBase: 5101.2, // base máxima mensual estimada 2026
  minBase: 1381.2,
  worker: { cc: 4.7, mei: 0.15, desempleoIndef: 1.55, desempleoTemp: 1.6, fp: 0.1, horasExtra: 4.7 },
  company: { cc: 23.6, mei: 0.75, desempleoIndef: 5.5, desempleoTemp: 6.7, fogasa: 0.2, fp: 0.6, atep: 1.0 },
}

const SCALE: [number, number][] = [
  [12450, 19], [20200, 24], [35200, 30], [60000, 37], [300000, 45], [Infinity, 47],
]
function scale(base: number) {
  let prev = 0
  let tax = 0
  for (const [lim, rate] of SCALE) {
    if (base <= prev) break
    tax += (Math.min(base, lim) - prev) * (rate / 100)
    prev = lim
  }
  return tax
}

function workReduction(rn: number) {
  if (rn <= 14852) return 7302
  if (rn <= 17673.52) return 7302 - 1.75 * (rn - 14852)
  if (rn <= 19747.5) return 2364.34 - 1.5 * (rn - 17673.52)
  return 0
}

export function minimoFamiliar(children: number) {
  const per = [2400, 2700, 4000, 4500]
  let m = 5550
  for (let i = 0; i < children; i++) m += per[Math.min(i, 3)]
  return m
}

export function workerSSRate(contract: Employee['contract']) {
  const w = SS_2026.worker
  return w.cc + w.mei + w.fp + (contract === 'temporal' ? w.desempleoTemp : w.desempleoIndef)
}
export function companySSRate(contract: Employee['contract']) {
  const c = SS_2026.company
  return c.cc + c.mei + c.fogasa + c.fp + c.atep + (contract === 'temporal' ? c.desempleoTemp : c.desempleoIndef)
}

/** Tipo de retención IRPF anual (simplificado, escala estatal+autonómica general). */
export function irpfRate(gross: number, children = 0, contract: Employee['contract'] = 'indefinido') {
  const ss = Math.min(gross / 12, SS_2026.maxBase) * 12 * (workerSSRate(contract) / 100)
  const rnPrev = gross - ss
  const rn = Math.max(0, rnPrev - 2000 - workReduction(rnPrev))
  const min = minimoFamiliar(children)
  let cuota = Math.max(0, scale(rn) - scale(min))
  const threshold = children === 0 ? 15876 : children === 1 ? 17197 : 18130
  if (gross <= threshold) return 0
  cuota = Math.min(cuota, (gross - threshold) * 0.43)
  let rate = (cuota / gross) * 100
  if (contract === 'temporal') rate = Math.max(rate, 2)
  return Math.round(rate * 100) / 100
}

export type Line = { concept: string; amount: number; base?: number; rate?: number; hint?: string }
export type Payslip = {
  month: string
  devengos: Line[]
  deducciones: Line[]
  empresa: Line[]
  bruto: number
  neto: number
  coste: number
  baseCC: number
  irpf: number
  hourly: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function payslip(emp: Employee, month: string, opts: { overtimeMin?: number; extraBonus?: number; salary?: number; reimburse?: number } = {}): Payslip {
  const salary = opts.salary ?? emp.salary
  const m = Number(month.slice(5, 7))
  const monthly = salary / emp.pagas
  const hourly = salary / (emp.weeklyHours * 52 - 23 * (emp.weeklyHours / 5) - 12 * (emp.weeklyHours / 5))
  const devengos: Line[] = [
    { concept: 'Salario base', amount: r2(monthly * 0.78) },
    { concept: 'Complemento de puesto', amount: r2(monthly * 0.22) },
  ]
  if (emp.pagas === 12) devengos.push({ concept: 'Prorrata pagas extra', amount: 0, hint: 'Incluida en el salario mensual' })
  if (emp.pagas === 14 && (m === 6 || m === 12)) devengos.push({ concept: m === 6 ? 'Paga extra de verano' : 'Paga extra de Navidad', amount: r2(monthly) })
  const ot = opts.overtimeMin ?? 0
  const otAmount = r2((ot / 60) * hourly * 1.25)
  if (ot > 0) devengos.push({ concept: 'Horas extraordinarias', amount: otAmount, hint: `${(ot / 60).toFixed(1)} h × ${(hourly * 1.25).toFixed(2)} €` })
  if (opts.extraBonus) devengos.push({ concept: 'Bonus', amount: r2(opts.extraBonus) })
  devengos.push({ concept: 'Retribución flexible · ticket comida', amount: 0, hint: 'Exento hasta 11 €/día' })
  const reimb = r2(opts.reimburse ?? 0)

  const bruto = r2(devengos.reduce((a, l) => a + l.amount, 0))
  const prorrata = emp.pagas === 14 ? (salary / 14) * 2 / 12 : 0
  const ordinary = bruto - otAmount - (emp.pagas === 14 && (m === 6 || m === 12) ? monthly : 0) - (opts.extraBonus ?? 0)
  const baseCC = r2(Math.min(SS_2026.maxBase, Math.max(SS_2026.minBase, ordinary + prorrata + (opts.extraBonus ?? 0))))
  const baseCP = r2(Math.min(SS_2026.maxBase, baseCC + otAmount))
  const w = SS_2026.worker
  const desemp = emp.contract === 'temporal' ? w.desempleoTemp : w.desempleoIndef
  const irpf = irpfRate(salary, emp.children, emp.contract)
  const deducciones: Line[] = [
    { concept: 'Contingencias comunes', base: baseCC, rate: w.cc, amount: r2((baseCC * w.cc) / 100) },
    { concept: 'MEI', base: baseCC, rate: w.mei, amount: r2((baseCC * w.mei) / 100) },
    { concept: 'Desempleo', base: baseCP, rate: desemp, amount: r2((baseCP * desemp) / 100) },
    { concept: 'Formación profesional', base: baseCP, rate: w.fp, amount: r2((baseCP * w.fp) / 100) },
  ]
  if (otAmount) deducciones.push({ concept: 'Horas extra', base: otAmount, rate: w.horasExtra, amount: r2((otAmount * w.horasExtra) / 100) })
  deducciones.push({ concept: 'Retención IRPF', base: bruto, rate: irpf, amount: r2((bruto * irpf) / 100) })
  const totalDed = deducciones.reduce((a, l) => a + l.amount, 0)
  if (reimb) devengos.push({ concept: 'Reembolso de gastos', amount: reimb, hint: 'Gastos aprobados · no cotiza ni tributa' })

  const c = SS_2026.company
  const cdes = emp.contract === 'temporal' ? c.desempleoTemp : c.desempleoIndef
  const empresa: Line[] = [
    { concept: 'Contingencias comunes', base: baseCC, rate: c.cc, amount: r2((baseCC * c.cc) / 100) },
    { concept: 'MEI', base: baseCC, rate: c.mei, amount: r2((baseCC * c.mei) / 100) },
    { concept: 'Desempleo', base: baseCP, rate: cdes, amount: r2((baseCP * cdes) / 100) },
    { concept: 'FOGASA', base: baseCP, rate: c.fogasa, amount: r2((baseCP * c.fogasa) / 100) },
    { concept: 'Formación profesional', base: baseCP, rate: c.fp, amount: r2((baseCP * c.fp) / 100) },
    { concept: 'AT y EP', base: baseCP, rate: c.atep, amount: r2((baseCP * c.atep) / 100) },
  ]
  const ss = empresa.reduce((a, l) => a + l.amount, 0)
  return { month, devengos, deducciones, empresa, bruto, neto: r2(bruto + reimb - totalDed), coste: r2(bruto + ss), baseCC, irpf, hourly }
}

/** Neto anual aproximado para el simulador. */
export function annualNet(emp: Employee, salary: number) {
  const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`)
  return months.reduce(
    (acc, m) => {
      const p = payslip(emp, m, { salary })
      return { neto: acc.neto + p.neto, coste: acc.coste + p.coste, bruto: acc.bruto + p.bruto }
    },
    { neto: 0, coste: 0, bruto: 0 },
  )
}

export const eur = (n: number, d = 2) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d })
