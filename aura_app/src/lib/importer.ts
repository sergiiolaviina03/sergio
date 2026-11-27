// Migración desde otros sistemas (Factorial, Sesame, Woffu, A3, Kenjo, Excel…): lectura de hojas de cálculo,
// detección del tipo de datos y de las columnas, normalización de fechas y emparejamiento de documentos.
import type { DocCategory, Employee } from '../types'

export type Kind = 'employees' | 'punches' | 'absences' | 'ignore'
export type Sheet = { file: string; name: string; headers: string[]; rows: Record<string, unknown>[] }

export const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim()

export const FIELDS: Record<Exclude<Kind, 'ignore'>, { key: string; label: string; required?: boolean; syn: string[] }[]> = {
  employees: [
    { key: 'name', label: 'Nombre completo', syn: ['nombre completo', 'empleado', 'nombre y apellidos', 'full name', 'trabajador', 'persona', 'colaborador', 'employee', 'employee name'] },
    { key: 'firstName', label: 'Nombre', syn: ['nombre', 'first name', 'firstname', 'nombre de pila'] },
    { key: 'lastName', label: 'Apellidos', syn: ['apellidos', 'apellido', 'last name', 'lastname', 'surname', 'primer apellido'] },
    { key: 'email', label: 'Email', syn: ['email', 'correo', 'e mail', 'correo electronico', 'email corporativo', 'work email', 'email de trabajo', 'login email'] },
    { key: 'dni', label: 'DNI / NIE', syn: ['dni', 'nif', 'nie', 'dni/nie', 'documento', 'documento de identidad', 'identifier', 'id number', 'numero de identificacion'] },
    { key: 'role', label: 'Puesto', syn: ['puesto', 'cargo', 'job title', 'rol', 'posicion', 'role', 'position', 'categoria profesional'] },
    { key: 'team', label: 'Equipo / departamento', syn: ['equipo', 'departamento', 'department', 'area', 'team', 'equipos', 'teams'] },
    { key: 'manager', label: 'Responsable', syn: ['responsable', 'manager', 'jefe', 'supervisor', 'reporta a', 'reports to', 'manager name'] },
    { key: 'zone', label: 'Centro de trabajo', syn: ['centro', 'oficina', 'centro de trabajo', 'sede', 'location', 'ubicacion', 'workplace', 'office'] },
    { key: 'hiredAt', label: 'Fecha de alta', syn: ['fecha alta', 'fecha de alta', 'fecha incorporacion', 'fecha de incorporacion', 'start date', 'fecha inicio contrato', 'antiguedad', 'hire date', 'fecha de inicio'] },
    { key: 'contract', label: 'Tipo de contrato', syn: ['tipo contrato', 'tipo de contrato', 'contrato', 'contract', 'contract type'] },
    { key: 'salary', label: 'Salario bruto anual', syn: ['salario', 'salario bruto', 'salario anual', 'sueldo', 'bruto anual', 'salary', 'salario bruto anual', 'retribucion anual'] },
    { key: 'weeklyHours', label: 'Horas semanales', syn: ['horas semanales', 'jornada', 'horas/semana', 'weekly hours', 'horas contrato', 'horas de contrato', 'jornada semanal'] },
    { key: 'phone', label: 'Teléfono', syn: ['telefono', 'movil', 'phone', 'telefono movil', 'mobile'] },
    { key: 'birthday', label: 'Fecha de nacimiento', syn: ['fecha nacimiento', 'fecha de nacimiento', 'nacimiento', 'birthday', 'birth date', 'cumpleanos'] },
  ],
  punches: [
    { key: 'employee', label: 'Empleado (nombre, email o DNI)', required: true, syn: ['empleado', 'nombre', 'nombre completo', 'email', 'trabajador', 'employee', 'persona', 'dni', 'full name'] },
    { key: 'date', label: 'Fecha', syn: ['fecha', 'dia', 'date', 'jornada', 'day'] },
    { key: 'in', label: 'Entrada', syn: ['entrada', 'hora entrada', 'hora de entrada', 'inicio', 'clock in', 'check in', 'clock in time', 'desde', 'start'] },
    { key: 'out', label: 'Salida', syn: ['salida', 'hora salida', 'hora de salida', 'fin', 'clock out', 'check out', 'clock out time', 'hasta', 'end'] },
    { key: 'breakMin', label: 'Pausas (minutos)', syn: ['pausa', 'pausas', 'descanso', 'descansos', 'break', 'breaks', 'minutos pausa', 'pausas min'] },
    { key: 'type', label: 'Tipo de evento', syn: ['tipo', 'evento', 'accion', 'event', 'type', 'tipo de fichaje'] },
    { key: 'datetime', label: 'Fecha y hora', syn: ['fecha y hora', 'timestamp', 'fecha hora', 'datetime', 'hora fichaje', 'momento'] },
    { key: 'zone', label: 'Centro / ubicación', syn: ['centro', 'ubicacion', 'location', 'oficina', 'lugar'] },
  ],
  absences: [
    { key: 'employee', label: 'Empleado', required: true, syn: ['empleado', 'nombre', 'nombre completo', 'email', 'trabajador', 'employee', 'persona', 'dni'] },
    { key: 'type', label: 'Tipo de ausencia', required: true, syn: ['tipo', 'tipo de ausencia', 'politica', 'motivo', 'ausencia', 'leave type', 'tipo ausencia', 'concepto', 'policy'] },
    { key: 'from', label: 'Desde', required: true, syn: ['desde', 'inicio', 'fecha inicio', 'start', 'fecha desde', 'start date', 'fecha de inicio', 'primer dia'] },
    { key: 'to', label: 'Hasta', syn: ['hasta', 'fin', 'fecha fin', 'end', 'fecha hasta', 'end date', 'fecha de fin', 'ultimo dia'] },
    { key: 'status', label: 'Estado', syn: ['estado', 'status', 'aprobacion'] },
    { key: 'hours', label: 'Horas', syn: ['horas', 'hours', 'duracion horas'] },
    { key: 'note', label: 'Comentario', syn: ['comentario', 'nota', 'observaciones', 'description', 'descripcion', 'motivo detallado'] },
  ],
}

export const SOURCES = [
  { id: 'factorial', name: 'Factorial', how: 'Personas → Exportar (Excel) para la plantilla · Control horario → Exportar para fichajes · Ausencias → Exportar · Documentos: descarga las carpetas de cada empleado.' },
  { id: 'sesame', name: 'Sesame HR', how: 'Empleados → Exportar · Fichajes → Informes → Exportar Excel · Vacaciones → Exportar · Documentos: descarga por empleado.' },
  { id: 'woffu', name: 'Woffu', how: 'Usuarios → Exportar · Informes → Fichajes · Informes → Ausencias · Documentos desde la ficha de cada persona.' },
  { id: 'a3', name: 'A3innuva / A3nom', how: 'Trabajadores → Listados → Exportar a Excel. Las nóminas en PDF se pueden subir en bloque como documentos.' },
  { id: 'kenjo', name: 'Kenjo / Personio / BambooHR', how: 'Exporta la lista de empleados a CSV o Excel y los informes de asistencia y ausencias.' },
  { id: 'excel', name: 'Excel o CSV propio', how: 'Cualquier hoja con una fila de títulos: Aura reconoce columnas como «Nombre», «DNI», «Entrada», «Salida», «Desde», «Hasta»…' },
  { id: 'aura', name: 'Copia de Aura', how: 'Archivo .json exportado desde Ajustes → Exportar copia completa de otra instalación de Aura.' },
]

/** Lee CSV, XLSX, XLS u ODS en hojas con cabeceras. */
export async function readSpreadsheet(file: File): Promise<Sheet[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: false })
  const out: Sheet[] = []
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' })
    // La fila de cabeceras es la primera con al menos 2 celdas de texto
    const hi = grid.findIndex((r) => r.filter((c) => typeof c === 'string' && c.trim()).length >= 2)
    if (hi < 0) continue
    const headers = grid[hi].map((h, i) => String(h || `Columna ${i + 1}`).trim())
    const rows = grid
      .slice(hi + 1)
      .filter((r) => r.some((c) => String(c).trim() !== ''))
      .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])))
    if (rows.length) out.push({ file: file.name, name, headers, rows })
  }
  return out
}

/** Asigna cada campo a la columna que mejor encaja. */
export function autoMap(kind: Exclude<Kind, 'ignore'>, headers: string[]) {
  const map: Record<string, string> = {}
  const used = new Set<string>()
  for (const f of FIELDS[kind]) {
    let best = ''
    let score = 0
    for (const h of headers) {
      if (used.has(h)) continue
      const n = norm(h)
      for (const s of f.syn) {
        const sc = n === s ? 3 : n.startsWith(s + ' ') || n.endsWith(' ' + s) ? 2 : n.includes(s) && s.length > 3 ? 1 : 0
        if (sc > score) {
          score = sc
          best = h
        }
      }
    }
    if (best) {
      map[f.key] = best
      used.add(best)
    }
  }
  return map
}

export function detectKind(headers: string[]): Kind {
  const score = (k: Exclude<Kind, 'ignore'>) => Object.keys(autoMap(k, headers)).length
  const h = headers.map(norm).join(' ')
  const pun = score('punches') + (/(entrada|salida|clock|fichaje|check)/.test(h) ? 3 : 0)
  const abs = score('absences') + (/(ausencia|vacacion|leave|desde|hasta|permiso)/.test(h) ? 3 : 0)
  const emp = score('employees') + (/(dni|nif|puesto|departamento|alta|salario|email)/.test(h) ? 2 : 0)
  const best = Math.max(pun, abs, emp)
  if (best < 3) return 'ignore'
  return best === pun ? 'punches' : best === abs ? 'absences' : 'employees'
}

/* ---------- Fechas y horas ---------- */
const excelDate = (n: number) => new Date(Math.round((n - 25569) * 864e5) + new Date().getTimezoneOffset() * 60000)

export function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return isNaN(+v) ? null : v
  if (typeof v === 'number') return v > 20000 && v < 80000 ? excelDate(v) : null
  const s = String(v).trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return new Date(y, +m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))
  }
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  m = norm(s).match(/^(\d{1,2}) (?:de )?([a-z]{3})[a-z]* (?:de )?(\d{4})/)
  if (m && months.indexOf(m[2]) >= 0) return new Date(+m[3], months.indexOf(m[2]), +m[1])
  const d = new Date(s)
  return isNaN(+d) ? null : d
}

/** Devuelve minutos desde medianoche. */
export function parseTime(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v < 1 ? Math.round(v * 1440) : v > 20000 ? Math.round((v % 1) * 1440) : null
  const m = String(v).match(/(\d{1,2})[:h.](\d{2})/)
  return m ? +m[1] * 60 + +m[2] : null
}

export const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function absenceType(v: unknown): string {
  const t = norm(v)
  if (/medic|doctor|consulta|cita/.test(t)) return 'med'
  if (/baja|enferm|incapacidad|\bit\b|sick|accidente/.test(t)) return 'sick'
  if (/teletrab|remot|casa|home/.test(t)) return 'remote'
  if (/propio|personal|libre disposicion|asunto/.test(t)) return 'own'
  return 'vac'
}
export function absenceStatus(v: unknown): 'approved' | 'pending' | 'rejected' {
  const t = norm(v)
  if (/pend|solicit|request/.test(t)) return 'pending'
  if (/rechaz|deneg|reject|denied|cancel/.test(t)) return 'rejected'
  return 'approved'
}

/* ---------- Personas ---------- */
const DNI = /\b([XYZ]?\d{7,8}[A-Z])\b/i
export function makeMatcher(emps: Employee[]) {
  const byEmail = new Map<string, Employee>()
  const byDni = new Map<string, Employee>()
  const byName = new Map<string, Employee>()
  for (const e of emps) {
    if (e.email) byEmail.set(e.email.toLowerCase(), e)
    if (e.dni) byDni.set(e.dni.toUpperCase(), e)
    const n = norm(e.name)
    byName.set(n, e)
    const parts = n.split(' ')
    if (parts.length > 1) byName.set(`${parts.slice(1).join(' ')} ${parts[0]}`, e) // «Apellidos Nombre»
  }
  return (v: unknown): Employee | undefined => {
    const s = String(v ?? '').trim()
    if (!s) return
    if (s.includes('@')) return byEmail.get(s.toLowerCase())
    const d = s.match(DNI)?.[1]
    if (d && byDni.has(d.toUpperCase())) return byDni.get(d.toUpperCase())
    const n = norm(s.replace(',', ' '))
    if (byName.has(n)) return byName.get(n)
    // «Apellidos, Nombre» o coincidencia por nombre + primer apellido
    if (s.includes(',')) {
      const [last, first] = s.split(',').map(norm)
      const hit = byName.get(`${first} ${last}`)
      if (hit) return hit
    }
    const toks = n.split(' ').filter((x) => x.length > 2)
    return emps.find((e) => {
      const en = norm(e.name).split(' ')
      return en.length >= 2 && toks.includes(en[0]) && toks.includes(en[1])
    })
  }
}

/** Empareja un archivo con su empleado por DNI, email o nombre en el nombre o la ruta del archivo. */
export function matchFile(path: string, emps: Employee[]) {
  const d = path.replace(/[_\-./\\]+/g, ' ').match(DNI)?.[1]?.toUpperCase()
  if (d) {
    const hit = emps.find((e) => e.dni?.toUpperCase() === d)
    if (hit) return hit
  }
  const n = norm(path.replace(/[_\-./\\]+/g, ' '))
  let best: Employee | undefined
  let bestScore = 0
  for (const e of emps) {
    const parts = norm(e.name).split(' ').filter((x) => x.length > 2)
    const hits = parts.filter((p) => new RegExp(`\\b${p}\\b`).test(n)).length
    const score = hits >= 2 ? hits + (n.includes(norm(e.name)) ? 2 : 0) : 0
    if (score > bestScore) {
      bestScore = score
      best = e
    }
  }
  return best
}

export function guessCategory(path: string): { category: DocCategory; title: string } {
  const n = norm(path)
  const base = path.split(/[\\/]/).pop()!.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim()
  if (/nomina|payslip|recibo de salario|salario/.test(n)) return { category: 'nomina', title: base }
  if (/contrato|contract|prorroga|anexo contrato/.test(n)) return { category: 'contrato', title: base }
  if (/anexo|addendum|teletrabajo/.test(n)) return { category: 'anexo', title: base }
  if (/politica|protocolo|codigo|manual|reglamento|policy|handbook/.test(n)) return { category: 'politica', title: base }
  if (/registro|jornada|fichaje|timesheet/.test(n)) return { category: 'registro', title: base }
  if (/dni|nie|pasaporte|certificado|titulo|formacion|cv|curriculum|justificante|baja|medico|carnet/.test(n)) return { category: 'personal', title: base }
  return { category: 'otros', title: base }
}

export const splitName = (row: Record<string, unknown>, map: Record<string, string>) => {
  const full = map.name ? String(row[map.name] ?? '').trim() : ''
  if (full) return full.includes(',') ? full.split(',').map((x) => x.trim()).reverse().join(' ') : full
  return [map.firstName && row[map.firstName], map.lastName && row[map.lastName]].filter(Boolean).join(' ').trim()
}
