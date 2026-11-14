// Edge Function: avisos de próximos episodios (web push).
//
// No la llama la app: la dispara un cron de Supabase (pg_cron + pg_net, ver
// docs/integraciones.md) una vez por hora. Por cada usuario con dispositivos
// suscritos (tabla `push_subscriptions`), mira las series (TMDB) y anime
// (AniList) que sigue y, si un episodio sale hoy y todavía no se avisó (tabla
// `push_notified`), manda el aviso a todos sus dispositivos.
//
// Secrets (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  claves VAPID (npx web-push generate-vapid-keys)
//   VAPID_SUBJECT                        "mailto:tu-correo@ejemplo.com" (o una URL https)
//   CRON_SECRET                          texto largo al azar; el cron lo manda en `x-cron-secret`
//   TMDB_API_KEY                         el mismo de media-search
// Sin los de VAPID o sin CRON_SECRET responde 503 y no hace nada.
//
// Se publica con la verificación de JWT apagada (supabase/config.toml): el
// cron no tiene un usuario; se protege con CRON_SECRET.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { handlePreflight, jsonResponse, errorResponse } from '../_shared/http.ts'
import { airKey, alertPayload, isDue, type Upcoming } from '../_shared/alerts.ts'
import { animeUpcoming, seriesUpcoming } from '../_shared/upcoming.ts'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')
const CRON_SECRET = Deno.env.get('CRON_SECRET')

/** Estados en los que interesa saber cuándo sale lo próximo (como `useUpcoming` en la app). */
const FOLLOWED = ['in_progress', 'paused', 'planned', 'wishlist']

interface Subscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface FollowedItem {
  id: string
  title: string
  media_type: 'series' | 'anime'
  source: string
  external_id: string
}

serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT || !CRON_SECRET) {
    return jsonResponse({ error: 'Los avisos no están configurados (faltan secrets).' }, 503)
  }
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return jsonResponse({ error: 'No autorizado.' }, 401)
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const now = new Date()

    const { data: subs, error } = await admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth')
    if (error) throw error
    const byUser = new Map<string, Subscription[]>()
    for (const s of (subs ?? []) as Subscription[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s])

    let sent = 0
    for (const [userId, userSubs] of byUser) {
      const { data: items, error: itemsError } = await admin
        .from('items')
        .select('id, title, media_type, source, external_id')
        .eq('user_id', userId)
        .in('media_type', ['series', 'anime'])
        .in('status', FOLLOWED)
        .not('external_id', 'is', null)
      if (itemsError) throw itemsError

      const followed = ((items ?? []) as FollowedItem[]).filter(
        (i) => (i.media_type === 'series' && i.source === 'tmdb') || (i.media_type === 'anime' && i.source === 'anilist')
      )
      const idsOf = (type: string) => [...new Set(followed.filter((i) => i.media_type === type).map((i) => i.external_id))]
      const [series, anime] = await Promise.all([seriesUpcoming(idsOf('series')), animeUpcoming(idsOf('anime'))])

      const due: { item: FollowedItem; episode: Upcoming }[] = []
      for (const [type, episodes] of [['series', series], ['anime', anime]] as const) {
        for (const episode of episodes) {
          if (!isDue(episode, now)) continue
          for (const item of followed) {
            if (item.media_type === type && item.external_id === episode.external_id) due.push({ item, episode })
          }
        }
      }
      if (due.length === 0) continue

      const { data: done } = await admin.from('push_notified').select('item_id, air_key').eq('user_id', userId)
      const notified = new Set((done ?? []).map((r: { item_id: string; air_key: string }) => `${r.item_id}|${r.air_key}`))

      for (const { item, episode } of due) {
        const key = airKey(episode)
        if (notified.has(`${item.id}|${key}`)) continue
        const payload = JSON.stringify(alertPayload(item.title, episode, item.id))
        const results = await Promise.allSettled(
          userSubs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload))
        )
        // Suscripciones que el navegador ya dio de baja (404/410): se borran.
        const gone = userSubs.filter((_, i) => {
          const r = results[i]
          return r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)
        })
        if (gone.length > 0) await admin.from('push_subscriptions').delete().in('id', gone.map((s) => s.id))
        // Solo se da por avisado si llegó a algún dispositivo: un fallo de red se reintenta en la próxima hora.
        if (results.some((r) => r.status === 'fulfilled')) {
          await admin.from('push_notified').upsert({ user_id: userId, item_id: item.id, air_key: key })
          sent++
        }
      }
    }
    return jsonResponse({ users: byUser.size, sent })
  } catch (err) {
    return errorResponse(err)
  }
})
