// Próximos episodios de series (TMDB) y anime (AniList), para los avisos.
// Es lo mismo que el modo `upcoming` de `media-search`, pero sin usuario
// logueado (lo llama un cron con la service role): por eso vive acá aparte.
import type { Upcoming } from './alerts.ts'

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')

/** Próximo episodio con fecha de una serie de TMDB (o nada). */
async function tmdbUpcoming(id: string): Promise<Upcoming | null> {
  if (!TMDB_API_KEY) return null
  // Acepta la API Key (v3) o el Read Access Token (v4, empieza con eyJ).
  const isToken = TMDB_API_KEY.startsWith('eyJ')
  const url = new URL(`https://api.themoviedb.org/3/tv/${id}`)
  url.searchParams.set('language', 'es-ES')
  if (!isToken) url.searchParams.set('api_key', TMDB_API_KEY)
  const res = await fetch(url, isToken ? { headers: { Authorization: `Bearer ${TMDB_API_KEY}` } } : undefined)
  if (!res.ok) return null
  const next = (await res.json()).next_episode_to_air
  if (!next?.air_date) return null
  return {
    external_id: id,
    air_date: next.air_date,
    season: next.season_number ?? null,
    episode: next.episode_number ?? null,
    name: next.name || null,
  }
}

/** Próximos episodios de varias series. Una que falla no corta las demás. */
export async function seriesUpcoming(ids: string[]): Promise<Upcoming[]> {
  const results = await Promise.allSettled(ids.map(tmdbUpcoming))
  return results.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []))
}

/** Próximos episodios de varios anime de AniList, en una consulta. */
export async function animeUpcoming(ids: string[]): Promise<Upcoming[]> {
  if (ids.length === 0) return []
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      query: `query ($ids: [Int]) {
        Page(perPage: 50) {
          media(id_in: $ids, type: ANIME) { id nextAiringEpisode { airingAt episode } }
        }
      }`,
      variables: { ids: ids.slice(0, 50).map(Number) },
    }),
  })
  if (!res.ok) return []
  const data = (await res.json()).data
  return (data?.Page?.media ?? [])
    .filter((m: { nextAiringEpisode?: { airingAt?: number } }) => m.nextAiringEpisode?.airingAt)
    .map((m: { id: number; nextAiringEpisode: { airingAt: number; episode?: number } }) => ({
      external_id: String(m.id),
      air_date: new Date(m.nextAiringEpisode.airingAt * 1000).toISOString(),
      season: null,
      episode: m.nextAiringEpisode.episode ?? null,
      name: null,
    }))
}
