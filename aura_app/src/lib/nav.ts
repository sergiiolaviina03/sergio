import { create } from 'zustand'
import type { Page } from './copilot'
import { parseQrHash } from './qr'

/** QR escaneado pendiente de procesar (se lee una vez). */
export let pendingQr: { zoneId: string; token: string } | null = null
export const takeQr = () => {
  const q = pendingQr
  pendingQr = null
  return q
}

// Rutas con hash simple (#jornada) para que funcionen también como enlace compartido.
const SLUG: Record<Page, string> = { home: 'inicio', clock: 'jornada', timesheet: 'hoja', timeoff: 'ausencias', payroll: 'nominas', documents: 'documentos', expenses: 'gastos', people: 'personas', shifts: 'turnos', import: 'importar', team: 'equipo', inbox: 'bandeja', ledger: 'registro', settings: 'ajustes', kiosk: 'quiosco' }
const BY_SLUG = Object.fromEntries(Object.entries(SLUG).map(([k, v]) => [v, k])) as Record<string, Page>

const read = (): Page => {
  const q = parseQrHash(location.hash)
  if (q) {
    pendingQr = q
    return 'clock'
  }
  const h = location.hash.replace(/^#\/?/, '').split('?')[0]
  return BY_SLUG[h] ?? (h in SLUG ? (h as Page) : 'home')
}

export const useNav = create<{ page: Page; go: (p: Page) => void; copilot: boolean; setCopilot: (v: boolean, seed?: string) => void; seed?: string }>((set) => ({
  page: read(),
  go: (p) => {
    try {
      if (location.hash !== `#${SLUG[p]}`) location.hash = SLUG[p]
    } catch {
      /* algunos visores no permiten cambiar el hash */
    }
    set({ page: p })
    window.scrollTo({ top: 0 })
  },
  copilot: false,
  setCopilot: (v, seed) => set({ copilot: v, seed }),
}))

window.addEventListener('hashchange', () => useNav.setState({ page: read() }))
export const go = (p: Page) => useNav.getState().go(p)
