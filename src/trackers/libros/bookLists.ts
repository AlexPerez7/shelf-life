// Estantes del librero. Los de estado y colecciones son fijos; los de género
// y autor se arman con los datos. El estante abierto vive en la URL
// (?estante=...) para que la barra inferior pueda llevar directo a uno.

import type { Item, ItemStatus } from '../../types/item'

export const shelfParam = 'estante'

export interface ShelfDef {
  id: string
  category: string
  name: string
  items: Item[]
}

const statusShelves: { id: string; name: string; statuses: ItemStatus[] }[] = [
  { id: 'leyendo', name: 'Leyendo', statuses: ['in_progress', 'paused'] },
  { id: 'por-leer', name: 'Por leer', statuses: ['wishlist', 'planned'] },
  { id: 'leidos', name: 'Leídos', statuses: ['completed'] },
  { id: 'abandonados', name: 'Abandonados', statuses: ['dropped'] },
]

const MAX_GENRE_SHELVES = 6
const MAX_AUTHOR_SHELVES = 6

const byRecent = (key: (i: Item) => string | null) => (a: Item, b: Item) =>
  (key(b) ?? '').localeCompare(key(a) ?? '')

/** Agrupa por un valor con varios por libro (géneros, autores). */
function groupBy(books: Item[], values: (b: Item) => string[], minSize: number, max: number) {
  const groups = new Map<string, Item[]>()
  for (const b of books) {
    for (const v of values(b)) {
      const key = v.trim()
      if (!key) continue
      groups.set(key, [...(groups.get(key) ?? []), b])
    }
  }
  return [...groups.entries()]
    .filter(([, items]) => items.length >= minSize)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, max)
}

/** Todos los estantes, agrupados por mueble. */
export function buildShelves(books: Item[]): { title: string; shelves: ShelfDef[] }[] {
  const reading = statusShelves.map((s) => {
    let items = books.filter((b) => s.statuses.includes(b.status))
    if (s.id === 'leyendo') items = [...items].sort(byRecent((i) => i.updated_at))
    if (s.id === 'leidos') items = [...items].sort(byRecent((i) => i.date_finished ?? i.updated_at))
    return { id: s.id, category: 'Estado', name: s.name, items }
  })

  const collections: ShelfDef[] = [
    {
      id: 'favoritos',
      category: 'Colección',
      name: 'Favoritos',
      items: books.filter((b) => b.is_favorite),
    },
    {
      id: 'mejores',
      category: 'Puntaje',
      name: '★★★★ o más',
      items: books.filter((b) => (b.rating ?? 0) >= 8).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
    },
  ].filter((s) => s.items.length > 0)

  const genres = groupBy(books, (b) => b.genres, 1, MAX_GENRE_SHELVES).map(([name, items]) => ({
    id: `genero:${name}`,
    category: 'Género',
    name,
    items,
  }))

  const authors = groupBy(books, (b) => b.metadata.authors ?? [], 2, MAX_AUTHOR_SHELVES).map(
    ([name, items]) => ({ id: `autor:${name}`, category: 'Autor', name, items })
  )

  return [
    { title: 'Mis lecturas', shelves: reading },
    { title: 'Colecciones', shelves: collections },
    { title: 'Géneros', shelves: genres },
    { title: 'Autores', shelves: authors },
  ].filter((unit) => unit.shelves.length > 0)
}

/** Busca un estante por id (incluidos los de género y autor). */
export function findShelf(books: Item[], id: string): ShelfDef | null {
  for (const unit of buildShelves(books)) {
    const shelf = unit.shelves.find((s) => s.id === id)
    if (shelf) return shelf
  }
  // Género o autor con pocos libros (no tiene repisa propia en el librero).
  const [kind, ...rest] = id.split(':')
  const name = rest.join(':')
  if (kind === 'genero' && name) {
    return { id, category: 'Género', name, items: books.filter((b) => b.genres.includes(name)) }
  }
  if (kind === 'autor' && name) {
    return {
      id,
      category: 'Autor',
      name,
      items: books.filter((b) => (b.metadata.authors ?? []).includes(name)),
    }
  }
  return null
}
