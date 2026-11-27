import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip, useMap, useMapEvents, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import type { Zone } from '../types'
import { useDark } from '../lib/hooks'

// Teselas libres de OpenStreetMap (sin API key). El estilo «limpio» se consigue con filtros CSS (ver index.css).
export function Tiles() {
  const dark = useDark()
  return (
    <TileLayer
      className={dark ? 'tiles-dark' : 'tiles-light'}
      key={dark ? 'd' : 'l'}
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      maxZoom={19}
    />
  )
}

function Fit({ points, zoom }: { points: [number, number][]; zoom?: number }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.setView(points[0], zoom ?? 16, { animate: true })
    else map.fitBounds(L.latLngBounds(points).pad(0.25), { animate: true, maxZoom: zoom ?? 17 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

function ClickCatcher({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng.lat, e.latlng.lng) })
  return null
}

export type Pin = { id: string; lat: number; lng: number; color: string; label?: string; pulse?: boolean; size?: number; html?: string }

const pulseIcon = (color: string, html?: string) =>
  L.divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div style="position:relative;width:44px;height:44px;display:grid;place-items:center">
      <span style="position:absolute;inset:6px;border-radius:999px;background:${color};opacity:.35;animation:ping2 2s cubic-bezier(0,0,.2,1) infinite"></span>
      ${html ?? `<span style="position:relative;width:16px;height:16px;border-radius:999px;background:${color};border:3px solid white;box-shadow:0 2px 10px ${color}"></span>`}
    </div>`,
  })

export function MapView({ zones, pins = [], fit, zoom, onClick, className, accuracy, interactive = true }: { zones: Zone[]; pins?: Pin[]; fit?: [number, number][]; zoom?: number; onClick?: (lat: number, lng: number) => void; className?: string; accuracy?: { lat: number; lng: number; r: number }; interactive?: boolean }) {
  const pts = fit ?? [...pins.map((p) => [p.lat, p.lng] as [number, number]), ...zones.map((z) => [z.lat, z.lng] as [number, number])]
  const center: [number, number] = pts[0] ?? [40.4169, -3.7035]
  return (
    <MapContainer center={center} zoom={zoom ?? 15} zoomControl={interactive} scrollWheelZoom={interactive} dragging={interactive} doubleClickZoom={interactive} attributionControl className={className} style={{ height: '100%', width: '100%' }}>
      <Tiles />
      <Fit points={pts} zoom={zoom} />
      <ClickCatcher onClick={onClick} />
      {zones.map((z) => (
        <Circle key={z.id} center={[z.lat, z.lng]} radius={z.radius} pathOptions={{ color: z.color, weight: 1.5, fillColor: z.color, fillOpacity: 0.12, dashArray: '4 4' }}>
          <Tooltip direction="top" opacity={1}>{z.name} · {z.radius} m</Tooltip>
        </Circle>
      ))}
      {accuracy && <Circle center={[accuracy.lat, accuracy.lng]} radius={accuracy.r} pathOptions={{ color: '#6366f1', weight: 0, fillOpacity: 0.12 }} />}
      {pins.map((p) =>
        p.pulse || p.html ? (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pulseIcon(p.color, p.html)}>
            {p.label && <Tooltip direction="top" offset={[0, -14]} opacity={1}>{p.label}</Tooltip>}
          </Marker>
        ) : (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={p.size ?? 6} pathOptions={{ color: 'white', weight: 2, fillColor: p.color, fillOpacity: 1 }}>
            {p.label && <Tooltip direction="top" opacity={1}>{p.label}</Tooltip>}
          </CircleMarker>
        ),
      )}
    </MapContainer>
  )
}
