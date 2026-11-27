// Lectura de tickets 100% en el dispositivo: Tesseract.js (Apache-2.0) con el modelo de español
// autoalojado en /ocr, y un intérprete de tickets españoles (total, IVA, fecha, comercio, categoría).
import type { Expense } from '../types'
import { isNative } from './platform'

export type ReceiptData = { comercio?: string; fecha?: string; total?: number; iva?: number; categoria?: Expense['category']; cif?: string; texto: string; confianza: number }

let workerP: Promise<import('tesseract.js').Worker> | null = null
function getWorker(onProgress?: (p: number) => void) {
  if (!workerP) {
    const base = new URL('ocr/', document.baseURI).href
    workerP = import('tesseract.js').then(({ createWorker }) =>
      createWorker('spa', 1, {
        workerPath: base + 'worker.min.js',
        corePath: base,
        langPath: base,
        // Android descomprime los .gz al empaquetar la app: allí el modelo va sin comprimir
        gzip: !isNative,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') progress?.(m.progress)
        },
      }),
    )
  }
  progress = onProgress
  return workerP
}
let progress: ((p: number) => void) | undefined

const num = (s: string) => parseFloat(s.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
const AMOUNT = /(\d{1,4}(?:[.\s]\d{3})*[.,]\d{2})\s*(?:€|eur)?/i

export function parseReceipt(text: string, confianza = 0): ReceiptData {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const lower = lines.map((l) => l.toLowerCase())
  // Total: la línea con «total» (no subtotal) y su importe; si no, el mayor importe del ticket
  let total: number | undefined
  for (let i = lower.length - 1; i >= 0; i--) {
    if (/total|importe|a pagar|tarjeta|efectivo/.test(lower[i]) && !/sub ?total|base/.test(lower[i])) {
      const m = lines[i].match(AMOUNT) ?? lines[i + 1]?.match(AMOUNT)
      if (m) {
        total = num(m[1])
        if (/total/.test(lower[i])) break
      }
    }
  }
  const all = [...text.matchAll(new RegExp(AMOUNT, 'gi'))].map((m) => num(m[1])).filter((n) => n > 0 && n < 10000)
  if (total == null && all.length) total = Math.max(...all)
  // IVA
  let iva: number | undefined
  const ivaLine = lines.find((l) => /i\.?v\.?a|cuota/i.test(l) && AMOUNT.test(l))
  if (ivaLine) {
    const ms = [...ivaLine.matchAll(new RegExp(AMOUNT, 'gi'))].map((m) => num(m[1]))
    iva = ms.find((n) => total == null || n < total * 0.3)
  }
  if (iva == null && total != null) {
    const pct = text.match(/(\d{1,2})[.,]?0?0?\s?%/)
    if (pct && [4, 10, 21].includes(+pct[1])) iva = Math.round((total - total / (1 + +pct[1] / 100)) * 100) / 100
  }
  // Fecha dd/mm/aa(aa)
  let fecha: string | undefined
  const d = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/)
  if (d) {
    const y = d[3].length === 2 ? 2000 + +d[3] : +d[3]
    if (+d[2] <= 12 && +d[1] <= 31) fecha = `${y}-${String(+d[2]).padStart(2, '0')}-${String(+d[1]).padStart(2, '0')}`
  }
  const cif = text.match(/\b([A-HJNP-SUVW][-\s]?\d{7}[0-9A-J]|\d{8}[A-Z])\b/)?.[1]
  // Comercio: primera línea con letras que no sea dirección, CIF o «factura»
  const comercio = lines.find((l) => /[a-záéíóúñ]{3,}/i.test(l) && !/factura|ticket|simplificada|c\/|calle|avda|cif|nif|tel|www|fecha/i.test(l))?.replace(/[^\p{L}\d\s&.'-]/gu, '').trim()
  const t = text.toLowerCase()
  const categoria: Expense['category'] = /restaur|bar |cafe|menu|men[uú]|comida|cerveza|caña|pan|bocadillo|pizza|burger/.test(t)
    ? 'comida'
    : /renfe|taxi|cabify|uber|bolt|metro|autob|vuelo|iberia|vueling|ryanair|parking|aparcamiento|gasolin|repsol|cepsa|peaje/.test(t)
      ? 'transporte'
      : /hotel|hostal|apartament|booking|noche/.test(t)
        ? 'alojamiento'
        : /software|licencia|suscrip|figma|adobe|google|microsoft|notion|slack/.test(t)
          ? 'software'
          : /papeler|material|oficina|imprent|amazon|fnac|media ?markt/.test(t)
            ? 'material'
            : 'otros'
  return { comercio: comercio?.slice(0, 40), fecha, total, iva, cif, categoria, texto: text, confianza }
}

export async function readReceipt(img: Blob, onProgress?: (p: number) => void): Promise<ReceiptData> {
  const w = await getWorker(onProgress)
  const { data } = await w.recognize(img)
  return parseReceipt(data.text, data.confidence)
}
