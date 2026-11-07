// Orden y filtros del librero. Todo vive en la URL (?orden=, ?dir=, ?anio=,
// ?genero=, ?fav=1) para que se conserven al volver de una ficha.

import type { Item } from '../types/item'
import { finishedDates, finishedInYear } from './readings'

export type BookSort = 'agregado' | 'titulo' | 'autor' | 'puntaje' | 'paginas' | 'terminado' | 'publicado'
export type SortDir = 'asc' | 'desc'

export const bookSorts: { id: BookSort; label: string }[] = [
  { id: 'agregado', label: 'Agregado' },
  { id: 'titulo', label: 'Título' },
  { id: 'autor', label: 'Autor' },
  { id: 'puntaje', label: 'Puntaje' },
  { id: 'paginas', label: 'Páginas' },
  { id: 'terminado', label: 'Terminado' },
  { id: 'publicado', label: 'Publicación' },
]

export interface BookView {
  /** Sin orden elegido (y sin filtros) se ve el librero por estantes. */
  sort: BookSort | null
  /** Dirección elegida; si no, la natural de cada orden. */
  dir: SortDir | null
  year: number | null
  genre: string | null
  favorites: boolean
}

export const viewParams = { sort: 'orden', dir: 'dir', year: 'anio', genre: 'genero', favorites: 'fav' } as const

/** Dirección natural: alfabético de la A a la Z, lo demás de mayor o más nuevo a menor. */
export function defaultDir(sort: BookSort): SortDir {
  return sort === 'titulo' || sort === 'autor' ? 'asc' : 'desc'
}

/** Cómo se llama cada dirección según el orden (primero la ascendente). */
export function dirLabels(sort: BookSort): [string, string] {
  if (sort === 'titulo' || sort === 'autor') return ['De la A a la Z', 'De la Z a la A']
  if (sort === 'puntaje' || sort === 'paginas') return ['Menor primero', 'Mayor primero']
  return ['Más antiguo primero', 'Más nuevo primero']
}

export function parseBookView(params: URLSearchParams): BookView {
  const sort = params.get(viewParams.sort)
  const dir = params.get(viewParams.dir)
  const year = Number(params.get(viewParams.year))
  return {
    sort: bookSorts.some((s) => s.id === sort) ? (sort as BookSort) : null,
    dir: dir === 'asc' || dir === 'desc' ? dir : null,
    year: Number.isInteger(year) && year > 0 ? year : null,
    genre: params.get(viewParams.genre) || null,
    favorites: params.get(viewParams.favorites) === '1',
  }
}

/** ¿Hay algo elegido? Entonces se muestra la lista plana en vez de los estantes. */
export function isViewActive(view: BookView) {
  return view.sort != null || view.year != null || view.genre != null || view.favorites
}

export function filterBooks(books: Item[], view: BookView): Item[] {
  return books.filter(
    (b) =>
      (!view.favorites || b.is_favorite) &&
      (!view.genre || b.genres.includes(view.genre)) &&
      (view.year == null || finishedInYear(b, view.year))
  )
}

const firstAuthor = (b: Item) => b.metadata.authors?.[0]?.trim() || null

/** Valor por el que se ordena (null = sin dato: va siempre al final). */
function sortKey(b: Item, sort: BookSort): string | number | null {
  switch (sort) {
    case 'agregado':
      return b.created_at
    case 'titulo':
      return b.title
    case 'autor':
      return firstAuthor(b)
    case 'puntaje':
      return b.rating
    case 'paginas':
      return b.progress_total
    case 'terminado':
      return finishedDates(b).sort().pop() ?? null
    case 'publicado':
      return b.release_date
  }
}

export function sortBooks(books: Item[], sort: BookSort, dir: SortDir = defaultDir(sort)): Item[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...books].sort((a, b) => {
    const ka = sortKey(a, sort)
    const kb = sortKey(b, sort)
    if (ka == null && kb == null) return a.title.localeCompare(b.title, 'es')
    if (ka == null) return 1
    if (kb == null) return -1
    const cmp =
      typeof ka === 'number' && typeof kb === 'number'
        ? ka - kb
        : String(ka).localeCompare(String(kb), 'es', { sensitivity: 'base' })
    return cmp !== 0 ? cmp * sign : a.title.localeCompare(b.title, 'es')
  })
}

/** Años en que se terminó algún libro, del más nuevo al más viejo. */
export function readYears(books: Item[]): number[] {
  const years = new Set<number>()
  for (const b of books) for (const d of finishedDates(b)) years.add(Number(d.slice(0, 4)))
  return [...years].filter((y) => y > 0).sort((a, b) => b - a)
}

/** Géneros que hay en el librero, de más a menos libros. */
export function bookGenres(books: Item[]): string[] {
  const counts = new Map<string, number>()
  for (const b of books) for (const g of b.genres) if (g.trim()) counts.set(g, (counts.get(g) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).map(([g]) => g)
}
