// "Más de este autor" en la ficha de un libro: los otros libros del mismo
// autor que ya están en el librero, y las sugerencias de Open Library que
// todavía no.

import type { Item, MediaSearchResult } from '../types/item'

/** Cuántas sugerencias se muestran. */
const MAX_SUGGESTIONS = 8

/** Texto comparable: sin tildes, mayúsculas ni signos. */
const norm = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Título sin subtítulo ("Dune: edición especial" y "Dune" son el mismo libro). */
const baseTitle = (title: string) => norm(title.split(/[:(]/)[0])

/** El autor principal del libro, o nada si no tiene. */
export function mainAuthor(item: Pick<Item, 'metadata'>): string | null {
  return item.metadata.authors?.find((a) => a.trim())?.trim() ?? null
}

/** Los otros libros del librero que comparten el autor, los más nuevos de publicar primero. */
export function ownBooksByAuthor(books: Item[], item: Item, author: string): Item[] {
  const wanted = norm(author)
  return books
    .filter((b) => b.id !== item.id && b.media_type === 'book')
    .filter((b) => (b.metadata.authors ?? []).some((a) => norm(a) === wanted))
    .sort(
      (a, b) =>
        (a.release_date ?? '9999').localeCompare(b.release_date ?? '9999') || a.title.localeCompare(b.title, 'es')
    )
}

/** Un libro del librero que es ese resultado (mismo id de Open Library, o mismo título base). */
export function libraryMatch(books: Item[], result: MediaSearchResult): Item | null {
  const title = baseTitle(result.title)
  return (
    books.find(
      (b) =>
        (b.source === result.source && b.external_id === result.external_id) ||
        (title !== '' && baseTitle(b.title) === title)
    ) ?? null
  )
}

/** Sugerencias: lo que devolvió Open Library menos lo que ya está en el librero (y el libro de la ficha). */
export function authorSuggestions(books: Item[], item: Item, results: MediaSearchResult[]): MediaSearchResult[] {
  const known = [item, ...books.filter((b) => b.media_type === 'book')]
  return results.filter((r) => libraryMatch(known, r) == null).slice(0, MAX_SUGGESTIONS)
}
