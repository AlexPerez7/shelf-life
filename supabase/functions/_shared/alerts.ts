// Lógica pura de los avisos de episodios (sin Deno ni red, para poder probarla
// con Vitest desde src/lib/episodeAlerts.test.ts).

/** Próximo episodio de una serie o anime que se sigue. */
export interface Upcoming {
  external_id: string
  /** 'YYYY-MM-DD' (TMDB, solo el día) o fecha y hora ISO (AniList). */
  air_date: string
  season: number | null
  episode: number | null
  name: string | null
}

const HOUR_MS = 3_600_000

/**
 * Hora (UTC) desde la que se avisa de los episodios que TMDB da solo con el
 * día: 12 UTC son las 9 de la mañana en Argentina, para no avisar de madrugada.
 */
export const DAY_ALERT_HOUR_UTC = 12

/**
 * ¿Ya toca avisar? Un episodio con día (TMDB): el día de estreno, desde la
 * mañana. Uno con hora (AniList): cuando falta una hora o menos.
 */
export function isDue(episode: Upcoming, now: Date): boolean {
  if (episode.air_date.length <= 10) {
    return episode.air_date === now.toISOString().slice(0, 10) && now.getUTCHours() >= DAY_ALERT_HOUR_UTC
  }
  const at = Date.parse(episode.air_date)
  return Number.isFinite(at) && at <= now.getTime() + HOUR_MS
}

/** Identifica el episodio para no avisarlo dos veces: "2x5" (temporada x número). */
export function airKey(episode: Upcoming): string {
  return `${episode.season ?? 0}x${episode.episode ?? 0}`
}

/** "T2 · E5", "Ep. 7" o, si no se sabe cuál, "Nuevo episodio". */
export function episodeText(episode: Upcoming): string {
  if (episode.season != null && episode.episode != null) return `T${episode.season} · E${episode.episode}`
  if (episode.episode != null) return `Ep. ${episode.episode}`
  return 'Nuevo episodio'
}

export interface AlertPayload {
  title: string
  body: string
  /** Ruta dentro de la app (relativa a su base), para abrir el título al tocar el aviso. */
  url: string
  /** Un aviso por episodio: si llega otro igual, reemplaza al anterior. */
  tag: string
}

export function alertPayload(title: string, episode: Upcoming, itemId: string, section = 'pantalla'): AlertPayload {
  return {
    title,
    body: `${episodeText(episode)} sale hoy`,
    url: `${section}/${itemId}`,
    tag: `${itemId}:${airKey(episode)}`,
  }
}
