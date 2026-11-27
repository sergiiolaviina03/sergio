// Aviso de llegada: mientras Aura está abierta (o instalada como app), detecta que entras en la
// geovalla de tu centro a tu hora de entrada y te propone fichar con un toque.
import { useEffect } from 'react'
import { useStore } from '../store'
import { distanceM } from './geo'
import { byDay, summarize } from './attendance'
import { dayKey, isoDow, toMin } from './time'
import { HOLIDAYS } from '../data/seed'
import { toast } from '../components/ui'
import { startClock } from '../components/ClockFlow'

export function useArrivalReminder() {
  const on = useStore((s) => s.settings.arrivalReminder && s.settings.locationMode === 'real')
  useEffect(() => {
    if (!on || !('geolocation' in navigator) || !navigator.permissions) return
    let watch: number | undefined
    let notified = ''
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((p) => {
      if (p.state !== 'granted') return // nunca pedimos permiso por sorpresa
      watch = navigator.geolocation.watchPosition(
        (pos) => {
          const s = useStore.getState()
          const me = s.employees.find((e) => e.id === s.meId)!
          const now = new Date()
          const k = dayKey(now)
          if (notified === k || isoDow(now) > 5 || HOLIDAYS[k]) return
          const mins = now.getHours() * 60 + now.getMinutes()
          if (Math.abs(mins - toMin(me.start)) > 90) return
          if (summarize(byDay(s.punches, me.id).get(k) ?? []).state !== 'none') return
          const z = s.zones.find((x) => distanceM({ lat: pos.coords.latitude, lng: pos.coords.longitude }, x) <= x.radius + Math.min(pos.coords.accuracy, 60))
          if (!z) return
          notified = k
          toast({ title: `Has llegado a ${z.name}`, body: '¿Fichas la entrada?', tone: 'ai', action: { label: 'Fichar', run: () => startClock('in') } })
          if ('Notification' in window && Notification.permission === 'granted') new Notification('Aura', { body: `Has llegado a ${z.name}. Toca para fichar la entrada.`, icon: './aura.svg' })
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 60_000 },
      )
    })
    return () => {
      if (watch != null) navigator.geolocation.clearWatch(watch)
    }
  }, [on])
}
