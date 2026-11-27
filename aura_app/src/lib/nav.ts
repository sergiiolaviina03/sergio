import { create } from 'zustand'
import type { Page } from './copilot'

const read = (): Page => ((location.hash.replace('#/', '') || 'home').split('?')[0] as Page)

export const useNav = create<{ page: Page; go: (p: Page) => void; copilot: boolean; setCopilot: (v: boolean, seed?: string) => void; seed?: string }>((set) => ({
  page: read(),
  go: (p) => {
    if (location.hash !== `#/${p}`) location.hash = `#/${p}`
    set({ page: p })
    window.scrollTo({ top: 0 })
  },
  copilot: false,
  setCopilot: (v, seed) => set({ copilot: v, seed }),
}))

window.addEventListener('hashchange', () => useNav.setState({ page: read() }))
export const go = (p: Page) => useNav.getState().go(p)
