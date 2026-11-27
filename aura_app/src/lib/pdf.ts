// PDFs generados en el propio dispositivo (jsPDF, libre): documentos firmados, nóminas y registro de jornada.
import { jsPDF } from 'jspdf'
import type { Employee, HRDocument, Punch } from '../types'
import type { Payslip } from './payroll'
import { eur } from './payroll'
import { COMPANY } from '../data/seed'
import { fmt, hm } from './time'
import { summarize } from './attendance'

const INK: [number, number, number] = [22, 22, 35]
const MUTED: [number, number, number] = [110, 110, 130]
const BRAND: [number, number, number] = [99, 91, 255]
const clean = (s: string) => s.replace(/[→]/g, '-').replace(/[^\x20-\x7E -ÿ€–—‘’“”•…\n]/g, '')

function header(pdf: jsPDF, title: string, sub: string) {
  pdf.setFillColor(...BRAND)
  pdf.roundedRect(40, 36, 22, 22, 6, 6, 'F')
  pdf.setDrawColor(255, 255, 255)
  pdf.setLineWidth(2.4)
  pdf.circle(51, 47, 5.5, 'S')
  pdf.setTextColor(...INK)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Aura', 70, 46)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...MUTED)
  pdf.text(`${COMPANY.legal} · CIF ${COMPANY.cif}`, 70, 56)
  pdf.setTextColor(...INK)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text(clean(title), 40, 96, { maxWidth: 515 })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...MUTED)
  pdf.text(clean(sub), 40, 114)
  return 136
}

function footer(pdf: jsPDF, line: string) {
  const n = pdf.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i)
    pdf.setFontSize(7)
    pdf.setTextColor(...MUTED)
    pdf.text(clean(line), 40, 815, { maxWidth: 440 })
    pdf.text(`${i} / ${n}`, 555, 815, { align: 'right' })
  }
}

function ensure(pdf: jsPDF, y: number, need: number) {
  if (y + need > 790) {
    pdf.addPage()
    return 50
  }
  return y
}

async function pngFromImage(src: string): Promise<string> {
  if (src.startsWith('data:image/png') || src.startsWith('data:image/jpeg')) return src
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width || 320
      c.height = img.height || 90
      c.getContext('2d')!.drawImage(img, 0, 0)
      res(c.toDataURL('image/png'))
    }
    img.onerror = () => res('')
    img.src = src
  })
}

export async function signedDocPdf(doc: HRDocument, emps: Employee[], onlyEmp?: string): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = header(pdf, doc.title, `Publicado el ${fmt(doc.createdAt, "d 'de' MMMM yyyy")} · Huella del documento SHA-256 ${doc.hash.slice(0, 32)}…`)
  pdf.setTextColor(...INK)
  for (const block of doc.body.split('\n\n')) {
    for (const line of block.split('\n')) {
      const isH = line.startsWith('## ')
      pdf.setFont('helvetica', isH ? 'bold' : 'normal')
      pdf.setFontSize(isH ? 11.5 : 10)
      const wrapped = pdf.splitTextToSize(clean(isH ? line.slice(3) : line), 515)
      y = ensure(pdf, y, wrapped.length * 14 + 6)
      pdf.text(wrapped, 40, y)
      y += wrapped.length * 14 + (isH ? 2 : 0)
    }
    y += 8
  }
  const sigs = doc.signatures.filter((s) => !onlyEmp || s.empId === onlyEmp)
  y = ensure(pdf, y + 10, 40)
  pdf.setDrawColor(230, 230, 238)
  pdf.line(40, y, 555, y)
  y += 22
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text(sigs.length ? 'Firmas' : 'Pendiente de firma', 40, y)
  y += 16
  for (const s of sigs) {
    const e = emps.find((x) => x.id === s.empId)!
    y = ensure(pdf, y, 110)
    pdf.setDrawColor(230, 230, 238)
    pdf.setFillColor(248, 248, 252)
    pdf.roundedRect(40, y, 515, 96, 8, 8, 'FD')
    const png = await pngFromImage(s.image)
    if (png) pdf.addImage(png, 'PNG', 52, y + 12, 170, 48)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...INK)
    pdf.text(clean(e.name), 52, y + 78)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...MUTED)
    const meta = [`Firmado el ${fmt(s.ts, "d 'de' MMMM yyyy 'a las' HH:mm:ss")}`, `Método: firma ${s.method === 'drawn' ? 'manuscrita en pantalla' : 'tipográfica'} · lectura ${Math.round(s.readSeconds)} s`, `Dispositivo: ${clean(s.device).slice(0, 60)}`, `Sello SHA-256: ${s.hash}`]
    meta.forEach((m, i) => pdf.text(m, 240, y + 22 + i * 13, { maxWidth: 305 }))
    y += 108
  }
  footer(pdf, `Documento con firma electrónica simple (Reglamento eIDAS, art. 3.10). Cada sello combina la huella del documento, la persona, el instante y la imagen de la firma. Verificable en Aura · Registro sellado.`)
  return pdf.output('blob')
}

export function payslipPdf(emp: Employee, p: Payslip, monthLabel: string): Blob {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = header(pdf, `Recibo de salarios · ${monthLabel}`, `${emp.name} · ${emp.role} · ${emp.contract === 'indefinido' ? 'Indefinido' : 'Temporal'} · ${emp.pagas} pagas · CCC ${COMPANY.ccc}`)
  const table = (title: string, lines: { concept: string; amount: number; rate?: number; base?: number }[], neg: boolean, total: number) => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(...MUTED)
    pdf.text(title.toUpperCase(), 40, y)
    y += 16
    pdf.setTextColor(...INK)
    for (const l of lines) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(clean(l.concept + (l.rate != null ? `  (${l.rate}% s/ ${eur(l.base ?? 0)})` : '')), 40, y)
      pdf.text(`${neg && l.amount ? '-' : ''}${eur(l.amount)}`, 555, y, { align: 'right' })
      y += 15
    }
    pdf.setDrawColor(230, 230, 238)
    pdf.line(40, y - 6, 555, y - 6)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Total', 40, y + 8)
    pdf.text(`${neg ? '-' : ''}${eur(total)}`, 555, y + 8, { align: 'right' })
    y += 36
  }
  table('Devengos', p.devengos, false, p.devengos.reduce((a, l) => a + l.amount, 0))
  table('Deducciones', p.deducciones, true, p.deducciones.reduce((a, l) => a + l.amount, 0))
  pdf.setFillColor(...BRAND)
  pdf.roundedRect(40, y, 515, 58, 10, 10, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(9)
  pdf.text('LÍQUIDO A PERCIBIR', 58, y + 22)
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text(eur(p.neto), 58, y + 46)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`Base CC ${eur(p.baseCC)} · IRPF ${p.irpf}%`, 537, y + 34, { align: 'right' })
  y += 84
  pdf.setTextColor(...INK)
  table('Aportación de la empresa', p.empresa, false, p.coste - p.bruto)
  pdf.setFontSize(9)
  pdf.setTextColor(...MUTED)
  pdf.text(`Coste total para la empresa: ${eur(p.coste)}`, 40, y)
  footer(pdf, 'Estimación orientativa con tipos de cotización 2026 y escala general de IRPF. La nómina oficial la valida la asesoría laboral.')
  return pdf.output('blob')
}

export function timesheetPdf(emp: Employee, monthLabel: string, days: { k: string; punches: Punch[]; planned: number }[], zoneName: (id?: string | null) => string): Blob {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = header(pdf, `Registro de jornada · ${monthLabel}`, `${emp.name} · ${emp.role} · jornada ${emp.weeklyHours} h/semana · art. 34.9 ET`)
  const cols = [40, 120, 170, 220, 290, 350, 410]
  pdf.setFontSize(8)
  pdf.setTextColor(...MUTED)
  ;['Día', 'Entrada', 'Salida', 'Pausas', 'Trabajado', 'Previsto', 'Lugar · sellos'].forEach((h, i) => pdf.text(h, cols[i], y))
  y += 12
  let tw = 0
  let tp = 0
  pdf.setTextColor(...INK)
  for (const d of days) {
    const s = summarize(d.punches)
    tw += s.worked
    tp += d.planned
    y = ensure(pdf, y, 14)
    pdf.setFontSize(8.5)
    pdf.text(clean(fmt(new Date(d.k + 'T12:00'), 'EEE d')), cols[0], y)
    pdf.text(s.first ? fmt(s.first, 'HH:mm') : '—', cols[1], y)
    const out = d.punches.findLast((p) => p.type === 'out')
    pdf.text(out ? fmt(out.ts, 'HH:mm') : s.punches.length ? 'falta' : '—', cols[2], y)
    pdf.text(s.breaks ? hm(s.breaks) : '—', cols[3], y)
    pdf.text(s.worked ? hm(s.worked) : '—', cols[4], y)
    pdf.text(d.planned ? hm(d.planned) : '—', cols[5], y)
    pdf.setTextColor(...MUTED)
    pdf.text(clean(d.punches.length ? `${zoneName(d.punches[0].zoneId)} · #${d.punches[0].seq}–#${d.punches.at(-1)!.seq}` : ''), cols[6], y, { maxWidth: 145 })
    pdf.setTextColor(...INK)
    y += 13
  }
  y += 8
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(`Total trabajado ${hm(tw)} · previsto ${hm(tp)} · balance ${hm(tw - tp, true)}`, 40, y)
  y += 50
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.line(40, y, 240, y)
  pdf.line(330, y, 530, y)
  pdf.text('Firma de la persona trabajadora', 40, y + 12)
  pdf.text('Firma de la empresa', 330, y + 12)
  footer(pdf, 'Generado desde el registro sellado de Aura. Cada fichaje está encadenado con SHA-256; los números # identifican los asientos verificables.')
  return pdf.output('blob')
}
