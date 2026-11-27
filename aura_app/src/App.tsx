import { lazy, Suspense, useEffect } from 'react'
import { Layout } from './components/Layout'
import { Copilot } from './components/Copilot'
import { ClockFlow } from './components/ClockFlow'
import { Toaster } from './components/ui'
import { SignFlow, MandatoryGate } from './pages/Documents'
import { cloud } from './lib/cloud'
import { AuthScreen, ErrorScreen, LoadingScreen, Onboarding } from './components/Auth'
import { useNav } from './lib/nav'
import { useStore } from './store'
import { useDark } from './lib/hooks'
import { useArrivalReminder } from './lib/arrival'
import { takeQr } from './lib/nav'
import { startClock } from './components/ClockFlow'
import { byDay, summarize } from './lib/attendance'
import { dayKey } from './lib/time'
const HomePage = lazy(() => import('./pages/Home').then((m) => ({ default: m.HomePage })))
const ClockPage = lazy(() => import('./pages/Clock').then((m) => ({ default: m.ClockPage })))
const TimesheetPage = lazy(() => import('./pages/Timesheet').then((m) => ({ default: m.TimesheetPage })))
const TimeOffPage = lazy(() => import('./pages/TimeOff').then((m) => ({ default: m.TimeOffPage })))
const PayrollPage = lazy(() => import('./pages/Payroll').then((m) => ({ default: m.PayrollPage })))
const TeamPage = lazy(() => import('./pages/Team').then((m) => ({ default: m.TeamPage })))
const InboxPage = lazy(() => import('./pages/Inbox').then((m) => ({ default: m.InboxPage })))
const LedgerPage = lazy(() => import('./pages/Ledger').then((m) => ({ default: m.LedgerPage })))
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })))
const DocumentsPage = lazy(() => import('./pages/Documents').then((m) => ({ default: m.DocumentsPage })))
const ExpensesPage = lazy(() => import('./pages/Expenses').then((m) => ({ default: m.ExpensesPage })))
const PeoplePage = lazy(() => import('./pages/People').then((m) => ({ default: m.PeoplePage })))
const ShiftsPage = lazy(() => import('./pages/Shifts').then((m) => ({ default: m.ShiftsPage })))
const ImportPage = lazy(() => import('./pages/Import').then((m) => ({ default: m.ImportPage })))
const KioskPage = lazy(() => import('./pages/Kiosk').then((m) => ({ default: m.KioskPage })))

const PAGES = { home: HomePage, clock: ClockPage, timesheet: TimesheetPage, timeoff: TimeOffPage, payroll: PayrollPage, documents: DocumentsPage, expenses: ExpensesPage, people: PeoplePage, shifts: ShiftsPage, import: ImportPage, team: TeamPage, inbox: InboxPage, ledger: LedgerPage, settings: SettingsPage, kiosk: KioskPage }

export default function App() {
  const page = useNav((s) => s.page)
  const viewAs = useStore((s) => s.settings.viewAs)
  const topUp = useStore((s) => s.topUp)
  const dark = useDark()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  useArrivalReminder()
  useEffect(() => {
    const q = takeQr()
    if (!q) return
    const s = useStore.getState()
    const st = summarize(byDay(s.punches, s.meId).get(dayKey(Date.now())) ?? []).state
    try {
      history.replaceState(null, '', '#jornada')
    } catch {
      /* sin historial */
    }
    setTimeout(() => startClock(st === 'working' ? 'out' : st === 'break' ? 'break_end' : 'in', 'qr', undefined, q), 400)
  }, [page])
  useEffect(() => {
    topUp()
    const i = setInterval(topUp, 60_000)
    return () => clearInterval(i)
  }, [topUp])
  const managerOnly = ['team', 'inbox', 'kiosk', 'people', 'shifts', 'import']
  const status = cloud((c) => c.status)
  if (status === 'loading') return <LoadingScreen />
  if (status === 'auth') return <><AuthScreen /><Toaster /></>
  if (status === 'onboarding') return <><Onboarding /><Toaster /></>
  if (status === 'error') return <ErrorScreen />
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
      <SignFlow />
      {page !== 'kiosk' && <MandatoryGate />}
      <Toaster />
    </>
  )
}
