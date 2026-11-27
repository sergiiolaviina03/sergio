import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { byDay, summarize } from './attendance'
import { dayKey } from './time'

export function useNow(ms = 1000) {
  const [now, set] = useState(() => Date.now())
  useEffect(() => {
    const i = setInterval(() => set(Date.now()), ms)
    return () => clearInterval(i)
  }, [ms])
  return now
}

export function useDays(empId: string) {
  const punches = useStore((s) => s.punches)
  return useMemo(() => byDay(punches, empId), [punches, empId])
}

export function useToday(empId: string) {
  const days = useDays(empId)
  const now = useNow(1000)
  return useMemo(() => summarize(days.get(dayKey(now)) ?? [], now), [days, now])
}

export function useMedia(q: string) {
  const [m, set] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const f = () => set(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [q])
  return m
}

export function useDark() {
  const theme = useStore((s) => s.settings.theme)
  const sys = useMedia('(prefers-color-scheme: dark)')
  return theme === 'dark' || (theme === 'system' && sys)
}
