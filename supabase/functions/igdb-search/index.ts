// Edge Function: proxy hacia IGDB.
// Secrets requeridos (nunca en el frontend):
//   supabase secrets set TWITCH_CLIENT_ID=xxx TWITCH_CLIENT_SECRET=xxx
//
// Modos (campo `mode` en el body):
//   - (default)      -> búsqueda por texto (`query`)
//   - "popular"      -> juegos con más hype de los últimos 2 años
//   - "timeToBeat"   -> duración estimada (`igdbId` y/o `title`), vía el
//                       endpoint oficial game_time_to_beats. Reemplaza al viejo
//                       scraping de HowLongToBeat, que dependía de un endpoint
//                       interno no documentado.
//   - "timeToBeatBatch" -> duración "normal" de varios juegos (`igdbIds`) en
//                       una sola consulta (estadística de backlog).
//   - "bySteam"      -> metadata de IGDB para juegos importados de Steam
//                       (`steamAppIds`), vía external_games.
//   - "covers"       -> portadas alternativas para "Cambiar portada": la del
//                       juego, las de cada región (game_localizations) y las
//                       de sus ediciones (version_parent) en IGDB (`igdbId`, o
//                       el primer resultado de buscar `title`), más la vertical
//                       de Steam (`steamAppId`) si existe.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { handlePreflight, jsonResponse, errorResponse } from '../_shared/http.ts'
import { requireUser } from '../_shared/supabase.ts'

const TWITCH_CLIENT_ID = Deno.env.get('TWITCH_CLIENT_ID')!
const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET')!

interface CachedToken {
  token: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }

  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  })

  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, {
    method: 'POST',
  })

  if (!res.ok) {
    throw new Error(`No se pudo obtener token de Twitch: ${res.status}`)
  }

  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    // Renovar 5 minutos antes de que expire
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  }
  return cachedToken.token
}

/** POST a un endpoint de IGDB con el body en formato Apicalypse. */
async function igdb(endpoint: string, body: string): Promise<unknown> {
  const token = await getAccessToken()
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Error de IGDB (${res.status}): ${text}`)
  }
  return res.json()
}

interface IgdbGame {
  id: number
  name: string
  cover?: { url: string }
  genres?: { name: string }[]
  platforms?: { name: string }[]
  first_release_date?: number
  summary?: string
}

function mapGames(games: IgdbGame[]) {
  return games.map((g) => ({
    id: g.id,
    name: g.name,
    cover_url: g.cover?.url ? `https:${g.cover.url.replace('t_thumb', 't_cover_big')}` : null,
    genres: g.genres?.map((genre) => genre.name) ?? [],
    platforms: g.platforms?.map((p) => p.name) ?? [],
    first_release_date: g.first_release_date ?? null,
    summary: g.summary ?? null,
  }))
}

const GAME_FIELDS =
  'fields name, cover.url, genres.name, platforms.name, first_release_date, summary;'

async function searchByText(query: string) {
  const body = `search "${query.replace(/"/g, '\\"')}";
${GAME_FIELDS}
limit 10;`
  const games = (await igdb('games', body)) as IgdbGame[]
  return mapGames(games)
}

async function popular() {
  const twoYearsAgo = Math.floor(Date.now() / 1000) - 2 * 365 * 24 * 60 * 60
  const body = `fields name, cover.url, genres.name, platforms.name, first_release_date, summary, hypes;
sort hypes desc;
where hypes != null & first_release_date > ${twoYearsAgo};
limit 10;`
  const games = (await igdb('games', body)) as IgdbGame[]
  return mapGames(games)
}

interface TimeToBeatRow {
  game_id: number
  hastily?: number
  normally?: number
  completely?: number
  count?: number
}

/** Segundos -> horas con 1 decimal, o null si no hay dato. */
function toHours(seconds?: number): number | null {
  if (!seconds || seconds <= 0) return null
  return Math.round((seconds / 3600) * 10) / 10
}

function mapTtb(row: TimeToBeatRow) {
  const result = {
    hastilyHours: toHours(row.hastily),
    normallyHours: toHours(row.normally),
    completelyHours: toHours(row.completely),
    count: row.count ?? 0,
  }
  // Si IGDB no tiene ningún tiempo cargado, tratamos como "sin dato".
  if (
    result.hastilyHours == null &&
    result.normallyHours == null &&
    result.completelyHours == null
  ) {
    return null
  }
  return result
}

async function timeToBeat(igdbId?: number, title?: string) {
  // Ids candidatos: el de IGDB si vino, si no los primeros resultados de buscar
  // por título (un juego importado de Steam o agregado a mano no tiene igdb_id).
  // Buscamos varios porque el primer match suele ser una edición/spin-off sin
  // datos (ej. "Hollow Knight: Silksong" en vez de "Hollow Knight").
  let candidateIds: number[] = []
  if (igdbId) {
    candidateIds = [igdbId]
  } else if (title) {
    const hits = (await igdb(
      'games',
      `search "${title.replace(/"/g, '\\"')}";
fields id;
limit 5;`
    )) as { id: number }[]
    candidateIds = hits.map((h) => h.id)
  }
  if (candidateIds.length === 0) return null

  const rows = (await igdb(
    'game_time_to_beats',
    `fields game_id, hastily, normally, completely, count;
where game_id = (${candidateIds.join(',')});
limit ${candidateIds.length};`
  )) as TimeToBeatRow[]
  if (rows.length === 0) return null

  // Preferimos el primer candidato (mejor match de nombre) que tenga datos;
  // si ninguno de esos sirve, el que tenga más registros.
  const byId = new Map(rows.map((r) => [r.game_id, r]))
  for (const id of candidateIds) {
    const mapped = byId.get(id) && mapTtb(byId.get(id)!)
    if (mapped) return mapped
  }
  const best = [...rows].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0]
  return mapTtb(best)
}

/** IGDB acepta hasta 500 resultados por consulta. */
const IGDB_MAX_LIMIT = 500
/** Tope de ids por request (una biblioteca de Steam grande ronda los miles). */
const MAX_IDS = 5000
/** Largo máximo de un texto de búsqueda / título. */
const MAX_TEXT = 200

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Enteros positivos únicos (los ids vienen del cliente: se validan). */
function toIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(
    0,
    MAX_IDS
  )
}

async function timeToBeatBatch(ids: number[]) {
  const result: Record<number, ReturnType<typeof mapTtb>> = {}
  for (const part of chunk(ids, IGDB_MAX_LIMIT)) {
    const rows = (await igdb(
      'game_time_to_beats',
      `fields game_id, hastily, normally, completely, count;
where game_id = (${part.join(',')});
limit ${part.length};`
    )) as TimeToBeatRow[]
    for (const row of rows) result[row.game_id] = mapTtb(row)
  }
  return result
}

interface ExternalGameRow {
  uid: string
  game?: IgdbGame
}

const EXTERNAL_GAME_FIELDS =
  'fields uid, game.id, game.name, game.cover.url, game.genres.name, game.platforms.name, game.first_release_date, game.summary;'

/**
 * Busca los juegos de IGDB que corresponden a appids de Steam. IGDB migró el
 * campo `category` a `external_game_source` (1 = Steam); se prueba el nuevo
 * y, si la API lo rechaza, el viejo.
 */
async function bySteam(appIds: number[]) {
  const result: Record<number, ReturnType<typeof mapGames>[number]> = {}
  for (const part of chunk(appIds, IGDB_MAX_LIMIT)) {
    const uids = part.map((id) => `"${id}"`).join(',')
    let rows: ExternalGameRow[]
    try {
      rows = (await igdb(
        'external_games',
        `${EXTERNAL_GAME_FIELDS}
where external_game_source = 1 & uid = (${uids});
limit ${part.length};`
      )) as ExternalGameRow[]
    } catch {
      rows = (await igdb(
        'external_games',
        `${EXTERNAL_GAME_FIELDS}
where category = 1 & uid = (${uids});
limit ${part.length};`
      )) as ExternalGameRow[]
    }
    for (const row of rows) {
      if (row.game?.id) result[Number(row.uid)] = mapGames([row.game])[0]
    }
  }
  return result
}

interface CoverOption {
  url: string
  source: 'igdb' | 'steam'
  /** Región o edición, para distinguirlas ("Japón", "Deluxe Edition"). */
  label: string | null
}

interface IgdbCoverGame {
  id: number
  name: string
  cover?: { image_id: string }
  game_localizations?: { name?: string; region?: { name?: string }; cover?: { image_id: string } }[]
}

/** Mismo tamaño en que se guardan las portadas al agregar (`t_cover_big`). */
const igdbCover = (imageId: string) => `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`

async function igdbCovers(igdbId: number | undefined, title: string | undefined): Promise<CoverOption[]> {
  let id = igdbId
  if (!id && title) {
    const hits = (await igdb(
      'games',
      `search "${title.replace(/"/g, '\\"')}";
fields id;
limit 1;`
    )) as { id: number }[]
    id = hits[0]?.id
  }
  if (!id) return []

  const [games, versions] = await Promise.all([
    igdb(
      'games',
      `fields name, cover.image_id, game_localizations.name, game_localizations.region.name, game_localizations.cover.image_id;
where id = ${id};
limit 1;`
    ) as Promise<IgdbCoverGame[]>,
    igdb(
      'games',
      `fields name, version_title, cover.image_id;
where version_parent = ${id} & cover != null;
limit 30;`
    ) as Promise<(IgdbCoverGame & { version_title?: string })[]>,
  ])
  const game = games[0]
  const out: CoverOption[] = []
  if (game?.cover?.image_id) out.push({ url: igdbCover(game.cover.image_id), source: 'igdb', label: 'IGDB' })
  for (const loc of game?.game_localizations ?? []) {
    if (loc.cover?.image_id) {
      out.push({ url: igdbCover(loc.cover.image_id), source: 'igdb', label: loc.region?.name ?? loc.name ?? null })
    }
  }
  for (const v of versions) {
    if (v.cover?.image_id) out.push({ url: igdbCover(v.cover.image_id), source: 'igdb', label: v.version_title ?? v.name })
  }
  return out
}

/** Portada vertical de la biblioteca de Steam (600x900), si el juego la tiene. */
async function steamCover(appId: number): Promise<CoverOption[]> {
  const candidates = [
    `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
  ]
  for (const url of candidates) {
    const res = await fetch(url, { method: 'HEAD' }).catch(() => null)
    if (res?.ok && (res.headers.get('content-type') ?? '').startsWith('image/')) {
      return [{ url, source: 'steam', label: 'Steam' }]
    }
  }
  return []
}

/** Sin repetidas; si una fuente falla, quedan las demás. */
async function covers(igdbId: number | undefined, title: string | undefined, steamAppId: number | undefined) {
  const results = await Promise.allSettled([
    igdbCovers(igdbId, title),
    steamAppId ? steamCover(steamAppId) : Promise.resolve([]),
  ])
  const seen = new Set<string>()
  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((c) => !seen.has(c.url) && seen.add(c.url))
}

serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    const auth = await requireUser(req)
    if (auth instanceof Response) return auth

    const { query, mode, igdbId, title, igdbIds, steamAppIds, steamAppId } = await req
      .json()
      .catch(() => ({}))

    if (mode === 'popular') {
      return jsonResponse(await popular())
    }

    if (mode === 'timeToBeat') {
      const id = Number(igdbId)
      const safeTitle = typeof title === 'string' ? title.slice(0, MAX_TEXT) : undefined
      return jsonResponse(
        await timeToBeat(Number.isInteger(id) && id > 0 ? id : undefined, safeTitle)
      )
    }

    if (mode === 'timeToBeatBatch') {
      return jsonResponse(await timeToBeatBatch(toIds(igdbIds)))
    }

    if (mode === 'covers') {
      const id = Number(igdbId)
      const appId = Number(steamAppId)
      const safeTitle = typeof title === 'string' ? title.slice(0, MAX_TEXT) : undefined
      return jsonResponse(
        await covers(
          Number.isInteger(id) && id > 0 ? id : undefined,
          safeTitle,
          Number.isInteger(appId) && appId > 0 ? appId : undefined
        )
      )
    }

    if (mode === 'bySteam') {
      return jsonResponse(await bySteam(toIds(steamAppIds)))
    }

    if (!query || typeof query !== 'string') {
      return jsonResponse({ error: 'Falta el parámetro query' }, 400)
    }

    return jsonResponse(await searchByText(query.slice(0, MAX_TEXT)))
  } catch (err) {
    return errorResponse(err)
  }
})
