import { lazy, Suspense, useEffect } from 'react'
import { Layout } from './components/Layout'
import { Copilot } from './components/Copilot'
import { ClockFlow } from './components/ClockFlow'
import { Toaster } from './components/ui'
import { useNav } from './lib/nav'
import { useStore } from './store'
import { useDark } from './lib/hooks'
const HomePage = lazy(() => import('./pages/Home').then((m) => ({ default: m.HomePage })))
const ClockPage = lazy(() => import('./pages/Clock').then((m) => ({ default: m.ClockPage })))
const TimesheetPage = lazy(() => import('./pages/Timesheet').then((m) => ({ default: m.TimesheetPage })))
const TimeOffPage = lazy(() => import('./pages/TimeOff').then((m) => ({ default: m.TimeOffPage })))
const PayrollPage = lazy(() => import('./pages/Payroll').then((m) => ({ default: m.PayrollPage })))
const TeamPage = lazy(() => import('./pages/Team').then((m) => ({ default: m.TeamPage })))
const InboxPage = lazy(() => import('./pages/Inbox').then((m) => ({ default: m.InboxPage })))
const LedgerPage = lazy(() => import('./pages/Ledger').then((m) => ({ default: m.LedgerPage })))
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })))
const KioskPage = lazy(() => import('./pages/Kiosk').then((m) => ({ default: m.KioskPage })))

const PAGES = { home: HomePage, clock: ClockPage, timesheet: TimesheetPage, timeoff: TimeOffPage, payroll: PayrollPage, team: TeamPage, inbox: InboxPage, ledger: LedgerPage, settings: SettingsPage, kiosk: KioskPage }

export default function App() {
  const page = useNav((s) => s.page)
  const viewAs = useStore((s) => s.settings.viewAs)
  const topUp = useStore((s) => s.topUp)
  const dark = useDark()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  useEffect(() => {
    topUp()
    const i = setInterval(topUp, 60_000)
    return () => clearInterval(i)
  }, [topUp])
  const managerOnly = ['team', 'inbox', 'kiosk']
  const P = (managerOnly.includes(page) && viewAs !== 'manager' ? HomePage : PAGES[page]) ?? HomePage
  return (
    <>
      <Layout>
        <Suspense fallback={<div className="h-[60vh] grid place-items-center"><div className="h-8 w-8 rounded-full border-2 border-brand border-t-transparent animate-spin" /></div>}>
          <P />
        </Suspense>
      </Layout>
      <ClockFlow />
      <Copilot />
      <Toaster />
    </>
  )
}
