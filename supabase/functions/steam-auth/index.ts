// Edge Function: "Sign in through Steam" (OpenID 2.0).
// Steam no tiene OAuth; OpenID solo devuelve el SteamID64 (número público), no
// da token ni acceso a la API. La API key sigue siendo de la app (STEAM_API_KEY).
//
// Secrets requeridos:
//   supabase secrets set STEAM_API_KEY=xxx
//
// Acciones (campo `action` en el body, ambas requieren usuario autenticado):
//   - "start"  { returnTo }  -> devuelve { url } para redirigir el navegador a Steam
//   - "verify" { params }    -> params = todos los openid.* que Steam mandó al
//                               volver; valida la firma con Steam, saca el
//                               SteamID64 y lo guarda en profiles del usuario.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { handlePreflight, jsonResponse, errorResponse } from '../_shared/http.ts'
import { userClient } from '../_shared/supabase.ts'

const STEAM_OPENID = 'https://steamcommunity.com/openid/login'
const STEAM_API_KEY = Deno.env.get('STEAM_API_KEY')!
const CALLBACK_PATH = '/juegos/steam-import/callback'

// URLs base de la app a las que Steam puede devolver al usuario. Sin esta
// lista, la función armaba un login de Steam hacia cualquier https:// que le
// pasaran (open redirect firmado con la reputación de la app). Cada entrada es
// un origen, con la subcarpeta si la app no vive en la raíz (GitHub Pages):
//   supabase secrets set APP_ORIGINS=https://a.app,https://user.github.io/shelf-life
const ALLOWED_BASES = (
  Deno.env.get('APP_ORIGINS') ?? 'https://alexperez7.github.io/shelf-life'
)
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean)

/** returnTo válido: https, base permitida y ruta del callback. */
function isAllowedReturnTo(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      ALLOWED_BASES.some((base) => `${url.origin}${url.pathname}` === base + CALLBACK_PATH)
    )
  } catch {
    return false
  }
}

function buildLoginUrl(returnTo: string): string {
  const realm = new URL(returnTo).origin
  const p = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  })
  return `${STEAM_OPENID}?${p}`
}

/** Valida la respuesta de OpenID contra Steam y devuelve el SteamID64. */
async function verifyAssertion(params: Record<string, string>): Promise<string> {
  // La aserción tiene que venir del proveedor de Steam y apuntar a nuestra app;
  // si no, alguien podría reutilizar una aserción emitida para otro sitio.
  if (params['openid.op_endpoint'] !== STEAM_OPENID) {
    throw new Error('Respuesta de OpenID de un proveedor inesperado.')
  }
  if (!isAllowedReturnTo(params['openid.return_to']?.split('?')[0])) {
    throw new Error('Respuesta de OpenID para otro destino.')
  }

  const body = new URLSearchParams(params)
  body.set('openid.mode', 'check_authentication')

  const res = await fetch(STEAM_OPENID, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  if (!/is_valid\s*:\s*true/i.test(text)) {
    throw new Error('No se pudo verificar el inicio de sesión de Steam.')
  }

  const claimed = params['openid.claimed_id'] ?? params['openid.identity'] ?? ''
  const match = claimed.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/)
  if (!match) {
    throw new Error('Respuesta de Steam inesperada (no se encontró el SteamID).')
  }
  return match[1]
}

interface SteamPlayer {
  personaname?: string
  avatarmedium?: string
  communityvisibilitystate?: number
}

async function fetchPlayer(steamId: string): Promise<SteamPlayer | null> {
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.response?.players?.[0] ?? null
  } catch {
    return null
  }
}

serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    const supa = userClient(req)
    const {
      data: { user },
    } = await supa.auth.getUser()
    if (!user) return jsonResponse({ error: 'No autenticado.' }, 401)

    const { action, returnTo, params } = await req.json().catch(() => ({}))

    if (action === 'start') {
      if (!isAllowedReturnTo(returnTo)) {
        return jsonResponse({ error: 'returnTo no permitido.' }, 400)
      }
      return jsonResponse({ url: buildLoginUrl(returnTo) })
    }

    if (action === 'verify') {
      if (!params || typeof params !== 'object' || Array.isArray(params)) {
        return jsonResponse({ error: 'Faltan los parámetros de OpenID.' }, 400)
      }
      // Solo se reenvían a Steam los campos openid.* y como strings.
      const openid: Record<string, string> = {}
      for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
        if (k.startsWith('openid.') && typeof v === 'string') openid[k] = v
      }
      const steamId = await verifyAssertion(openid)
      const player = await fetchPlayer(steamId)

      const { error } = await supa.from('profiles').upsert({
        user_id: user.id,
        steam_id: steamId,
        steam_persona: player?.personaname ?? null,
        steam_avatar: player?.avatarmedium ?? null,
        updated_at: new Date().toISOString(),
      })
      if (error) throw new Error(`No se pudo guardar el perfil: ${error.message}`)

      return jsonResponse({
        steamId,
        persona: player?.personaname ?? null,
        avatar: player?.avatarmedium ?? null,
        // communityvisibilitystate: 3 = público, 1 = privado. Aun siendo
        // público, "Detalles del juego" puede estar oculto por separado; eso
        // solo se detecta al intentar leer la biblioteca.
        isPublic: player?.communityvisibilitystate === 3,
      })
    }

    return jsonResponse({ error: 'action debe ser "start" o "verify".' }, 400)
  } catch (err) {
    return errorResponse(err)
  }
})
