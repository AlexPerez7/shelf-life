// Tamaño de las portadas según dónde se muestran. Se guardan en tamaño
// grande (para el detalle), pero una miniatura de 40 px o un fondo que igual
// va difuminado no necesitan 500 px: cada CDN acepta otro tamaño en la URL.

export type CoverSize = 'thumb' | 'poster'

/**
 * - `thumb`: miniaturas (listas, historial, inicio) y fondos difuminados.
 * - `poster`: cuadrículas y repisas (~110-130 px de ancho).
 * URLs de otros orígenes (o ya chicas) quedan como están.
 */
export function sizedCover(url: string | null, size: CoverSize): string | null {
  if (!url) return url
  // TMDB: /t/p/w500/x.jpg
  if (url.includes('image.tmdb.org/t/p/')) {
    return url.replace(/\/t\/p\/(w\d+|original)\//, `/t/p/${size === 'thumb' ? 'w185' : 'w342'}/`)
  }
  // AniList: extraLarge vive en .../cover/large/, large en medium/ (~230 px).
  if (url.includes('anilistcdn/media/') && size === 'thumb') {
    return url.replace('/cover/large/', '/cover/medium/')
  }
  // Open Library: ...-L.jpg (-M ~180 px de ancho)
  if (url.includes('covers.openlibrary.org') && size === 'thumb') {
    return url.replace(/-L\.jpg/, '-M.jpg')
  }
  // IGDB: t_cover_big (264 px); t_cover_small (90 px) para miniaturas.
  if (url.includes('images.igdb.com') && size === 'thumb') {
    return url.replace('/t_cover_big/', '/t_cover_small_2x/')
  }
  return url
}
