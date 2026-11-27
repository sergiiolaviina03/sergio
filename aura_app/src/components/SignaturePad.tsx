import { useEffect, useRef, useState } from 'react'
import { Eraser, PenLine, Type } from 'lucide-react'
import { Tabs, cx } from './ui'

/** Firma manuscrita con trazo suavizado y sensible a la velocidad, o firma tipográfica. */
export function SignaturePad({ name, onChange }: { name: string; onChange: (png: string | null, method: 'drawn' | 'typed') => void }) {
  const [mode, setMode] = useState<'drawn' | 'typed'>('drawn')
  const [typed, setTyped] = useState(name)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [empty, setEmpty] = useState(true)
  const pts = useRef<{ x: number; y: number; t: number }[]>([])
  const width = useRef(2.6)

  const ctx = () => canvas.current!.getContext('2d')!
  const fit = () => {
    const c = canvas.current
    if (!c) return
    const r = c.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    c.width = r.width * dpr
    c.height = r.height * dpr
    const x = ctx()
    x.scale(dpr, dpr)
    x.lineCap = 'round'
    x.lineJoin = 'round'
    x.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink') ? `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--ink').trim().replace(/ /g, ',')})` : '#161623'
  }
  useEffect(() => {
    if (mode === 'drawn') {
      fit()
      setEmpty(true)
      onChange(null, 'drawn')
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'typed') return
    if (!typed.trim()) return onChange(null, 'typed')
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 180
    const x = c.getContext('2d')!
    x.fillStyle = '#1e1b4b'
    let size = 84
    x.font = `${size}px Caveat, 'Segoe Script', cursive`
    while (x.measureText(typed).width > 600 && size > 30) x.font = `${(size -= 4)}px Caveat, 'Segoe Script', cursive`
    x.fillText(typed, 20, 120)
    onChange(c.toDataURL('image/png'), 'typed')
  }, [typed, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }
  }
  const down = (e: React.PointerEvent) => {
    canvas.current!.setPointerCapture(e.pointerId)
    pts.current = [pos(e)]
  }
  const move = (e: React.PointerEvent) => {
    if (!pts.current.length) return
    const p = pos(e)
    const a = pts.current.at(-1)!
    const v = Math.hypot(p.x - a.x, p.y - a.y) / Math.max(1, p.t - a.t)
    width.current = width.current * 0.7 + Math.max(1.2, Math.min(3.4, 3.6 - v * 1.1)) * 0.3
    const x = ctx()
    x.lineWidth = width.current * (e.pressure && e.pointerType === 'pen' ? 0.6 + e.pressure : 1)
    x.beginPath()
    const prev = pts.current.at(-2) ?? a
    x.moveTo((prev.x + a.x) / 2, (prev.y + a.y) / 2)
    x.quadraticCurveTo(a.x, a.y, (a.x + p.x) / 2, (a.y + p.y) / 2)
    x.stroke()
    pts.current.push(p)
    if (empty) setEmpty(false)
  }
  const up = () => {
    if (pts.current.length > 1) {
      // Exporta en tinta oscura sobre transparente, válida en claro y oscuro
      const c = canvas.current!
      const out = document.createElement('canvas')
      out.width = c.width
      out.height = c.height
      const o = out.getContext('2d')!
      o.drawImage(c, 0, 0)
      o.globalCompositeOperation = 'source-in'
      o.fillStyle = '#1e1b4b'
      o.fillRect(0, 0, out.width, out.height)
      onChange(out.toDataURL('image/png'), 'drawn')
    }
    pts.current = []
  }
  const clear = () => {
    const c = canvas.current!
    ctx().clearRect(0, 0, c.width, c.height)
    setEmpty(true)
    onChange(null, 'drawn')
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Tabs value={mode} onChange={setMode} items={[{ id: 'drawn', label: <span className="flex items-center gap-1.5"><PenLine size={13} /> Dibujar</span> }, { id: 'typed', label: <span className="flex items-center gap-1.5"><Type size={13} /> Escribir</span> }]} />
        {mode === 'drawn' && !empty && <button onClick={clear} className="btn-ghost h-8 ml-auto text-xs"><Eraser size={14} /> Borrar</button>}
      </div>
      {mode === 'drawn' ? (
        <div className="relative rounded-2xl border border-dashed border-line bg-sunken/60 h-44 touch-none">
          <canvas ref={canvas} className="absolute inset-0 w-full h-full cursor-crosshair" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          {empty && <div className="absolute inset-0 grid place-items-center pointer-events-none text-sm text-muted">Firma aquí con el dedo, el ratón o un lápiz</div>}
          <div className="absolute left-6 right-6 bottom-9 border-b border-line pointer-events-none" />
        </div>
      ) : (
        <div>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Tu nombre completo" />
          <div className={cx('mt-2 h-28 rounded-2xl bg-sunken/60 border border-line grid place-items-center text-5xl text-indigo-950 dark:text-indigo-200 overflow-hidden')} style={{ fontFamily: "Caveat, 'Segoe Script', cursive" }}>
            {typed || <span className="text-sm text-muted font-sans">Vista previa</span>}
          </div>
        </div>
      )}
    </div>
  )
}
