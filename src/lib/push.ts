// Avisos de próximos episodios (web push). La app guarda la suscripción del
// dispositivo en `push_subscriptions` (migración 0016); el aviso lo manda la
// Edge Function `episode-alerts` (ver docs/integraciones.md) y lo muestra el
// service worker (public/push-sw.js).

import { supabase } from './supabaseClient'
import { isMissingTable } from './pushErrors'

/** Clave pública VAPID (la privada solo está en Supabase). Sin ella, los avisos no se ofrecen. */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** Base64 "url safe" (como da la clave VAPID) -> bytes, que es lo que pide `subscribe`. */
export function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export type PushStatus =
  /** Este navegador no puede (en iPhone, solo con la app instalada en la pantalla de inicio). */
  | 'unsupported'
  /** Falta `VITE_VAPID_PUBLIC_KEY` en el build. */
  | 'unconfigured'
  /** El usuario bloqueó las notificaciones de la app. */
  | 'denied'
  | 'off'
  | 'on'

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function registration() {
  return navigator.serviceWorker.ready
}

/** Cómo está este dispositivo: sin soporte, sin configurar, bloqueado, apagado o encendido. */
export async function pushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) return 'unconfigured'
  if (Notification.permission === 'denied') return 'denied'
  const sub = await (await registration()).pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

/** Pide permiso, suscribe este dispositivo y guarda la suscripción. */
export async function enablePush(): Promise<void> {
  if (!VAPID_PUBLIC_KEY) throw new Error('Los avisos no están configurados en esta versión de la app.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Sin permiso para mostrar notificaciones.')
  const reg = await registration()
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(VAPID_PUBLIC_KEY) }))
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('El navegador no dio una suscripción válida.')
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, { onConflict: 'endpoint' })
  if (error) {
    await sub.unsubscribe().catch(() => {})
    throw isMissingTable(error)
      ? new Error('Falta aplicar la migración 0016 en Supabase para activar los avisos.')
      : error
  }
}

/** Da de baja este dispositivo (en el navegador y en la base). */
export async function disablePush(): Promise<void> {
  const sub = await (await registration()).pushManager.getSubscription()
  if (!sub) return
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  if (error && !isMissingTable(error)) throw error
  await sub.unsubscribe()
}
