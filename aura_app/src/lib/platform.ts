// Utilidades del navegador sin dependencias externas: descargas, voz y capacidades del dispositivo.

export const hasGeo = typeof navigator !== 'undefined' && 'geolocation' in navigator
export const hasCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

/** Descarga un archivo generado en el dispositivo. */
export async function saveFile(filename: string, data: Blob | string, type = 'application/octet-stream'): Promise<boolean> {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data
  try {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_')
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    return true
  } catch {
    return false
  }
}

/* ---------- Dictado (Web Speech API del navegador) ---------- */
type Rec = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void; onend: () => void; onerror: () => void }
const SR = typeof window !== 'undefined' ? ((window as unknown as { SpeechRecognition?: new () => Rec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition) : undefined
export const canDictate = !!SR

export function dictate(onPartial: (t: string) => void, onFinal: (t: string) => void, onEnd: () => void) {
  if (!SR) return () => {}
  const r = new SR()
  r.lang = 'es-ES'
  r.interimResults = true
  r.continuous = false
  r.onresult = (e) => {
    const res = e.results[e.results.length - 1]
    if (res.isFinal) onFinal(res[0].transcript)
    else onPartial(res[0].transcript)
  }
  r.onend = onEnd
  r.onerror = onEnd
  r.start()
  return () => r.stop()
}

/* ---------- Lectura en voz alta (speechSynthesis del navegador) ---------- */
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
export function speak(text: string) {
  if (!canSpeak) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/[•→]/g, ' '))
  u.lang = 'es-ES'
  const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('es'))
  if (v) u.voice = v
  u.rate = 1.04
  speechSynthesis.speak(u)
}
