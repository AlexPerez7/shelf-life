// Piezas comunes del detalle de un juego (GameDetail y sus secciones).

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export const inputClass =
  'w-full rounded-xl bg-background/40 px-3 py-2.5 text-sm text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-primary'

/**
 * La portada de IGDB se guarda en `t_cover_big` (264px de ancho), que a todo
 * el ancho del teléfono se ve borrosa. Para el hero se pide la versión 2x.
 */
export function heroCover(url: string | null): string | null {
  if (!url || !url.includes('images.igdb.com')) return url
  return url.replace('/t_cover_big/', '/t_cover_big_2x/')
}
