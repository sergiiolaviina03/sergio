export type PunchType = 'in' | 'out' | 'break_start' | 'break_end'
export type Method = 'app' | 'kiosk' | 'copilot' | 'correction' | 'qr' | 'import'

export type Zone = { id: string; name: string; address: string; lat: number; lng: number; radius: number; color: string }

export type Employee = {
  id: string
  name: string
  role: string
  team: string
  managerId?: string
  zoneId: string
  hue: number
  salary: number // bruto anual
  pagas: 12 | 14
  contract: 'indefinido' | 'temporal'
  weeklyHours: number
  start: string // HH:mm
  end: string
  breakMin: number
  remoteDays: number[] // 1=lunes … 5=viernes
  pin: string
  birthday: string // MM-DD
  hiredAt: string // YYYY-MM-DD
  children: number
  email?: string
  dni?: string
  phone?: string
}

export type Punch = {
  id: string
  seq: number
  empId: string
  type: PunchType
  ts: number
  lat?: number
  lng?: number
  acc?: number
  zoneId?: string | null // null = fuera de zona, undefined = sin ubicación
  dist?: number
  remote?: boolean
  method: Method
  selfie?: string
  flags: string[]
  note?: string
  prevHash: string
  hash: string
}

export type TimeOffType = { id: string; name: string; unit: 'días' | 'horas'; allowance: number | null; color: string; emoji: string; paid: boolean }
export type RequestStatus = 'pending' | 'approved' | 'rejected'
export type TimeOffRequest = { id: string; empId: string; typeId: string; from: string; to: string; hours?: number; note?: string; status: RequestStatus; createdAt: number; decidedBy?: string }

export type Correction = { id: string; empId: string; type: PunchType; ts: number; reason: string; status: RequestStatus; createdAt: number }
export type Period = { empId: string; month: string; status: 'open' | 'submitted' | 'approved' }

export type Notice = { id: string; ts: number; title: string; body?: string; read?: boolean; icon?: string }

export type Signature = { empId: string; ts: number; image: string; hash: string; method: 'drawn' | 'typed'; readSeconds: number; device: string }
export type DocCategory = 'contrato' | 'nomina' | 'personal' | 'politica' | 'registro' | 'anexo' | 'otros'
export type HRDocument = {
  id: string
  title: string
  category: DocCategory
  body: string // párrafos separados por \n\n; líneas que empiezan por "## " son títulos
  mandatory: boolean
  requireSignature: boolean
  due?: string
  audience: string[]
  createdAt: number
  createdBy: string
  hash: string
  attachment?: { name: string; size: number; hash: string; fileId?: string; type?: string }
  signatures: Signature[]
}

export type ExpenseStatus = 'pending' | 'approved' | 'paid' | 'rejected'
export type Expense = {
  id: string
  empId: string
  date: string
  merchant: string
  amount: number
  vat?: number
  category: 'comida' | 'transporte' | 'alojamiento' | 'material' | 'software' | 'kilometraje' | 'otros'
  note?: string
  km?: number
  receipt?: string // miniatura jpeg
  status: ExpenseStatus
  createdAt: number
  ai?: boolean
  flags: string[]
}

export type Shift = { id: string; empId: string; date: string; start: string; end: string; breakMin: number; zoneId: string; label?: string; published: boolean }
