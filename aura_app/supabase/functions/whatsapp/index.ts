// Función del servidor (Supabase Edge Function) que recibe los mensajes de WhatsApp Cloud API.
// Despliegue y configuración: aura_app/supabase/WHATSAPP.md
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handle, parseWebhook, toWhatsApp } from './handler.ts'
import { makeDeps } from './deps.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const deps = makeDeps(db)

async function validSignature(raw: string, header: string | null) {
  const secret = env('WA_APP_SECRET')
  if (!secret) return true // sin secreto configurado no se valida (solo para pruebas)
  if (!header?.startsWith('sha256=')) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))
  const hex = Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
  return hex === header.slice(7)
}

async function send(payload: unknown) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${env('WA_PHONE_ID')}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('WA_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) console.error('WhatsApp API', r.status, await r.text())
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  // Verificación del webhook al configurarlo en Meta
  if (req.method === 'GET') {
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env('WA_VERIFY_TOKEN')) return new Response(url.searchParams.get('hub.challenge') ?? '')
    return new Response('Forbidden', { status: 403 })
  }
  const raw = await req.text()
  if (!(await validSignature(raw, req.headers.get('x-hub-signature-256')))) return new Response('Bad signature', { status: 401 })
  try {
    for (const m of parseWebhook(JSON.parse(raw))) {
      const replies = await handle(m, deps).catch((e) => {
        console.error(e)
        return [{ kind: 'text' as const, text: 'Ha habido un problema al registrar tu fichaje. Inténtalo de nuevo en un momento o ficha desde la app.' }]
      })
      for (const o of replies) await send(toWhatsApp(m.from, o))
    }
  } catch (e) {
    console.error(e)
  }
  // Siempre 200 para que Meta no reintente en bucle
  return new Response('ok')
})
