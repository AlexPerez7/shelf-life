// Elegir la edición de un libro: los datos de la edición exacta (páginas,
// ISBN, editorial y, si se quiere, portada) que se copian a la ficha.

import type { Item, ItemWrite } from '../types/item'

/** Una edición de una obra de Open Library (modo `editions` de `media-search`). */
export interface BookEdition {
  id: string
  title: string
  publisher: string | null
  publish_date: string | null
  year: number | null
  pages: number | null
  isbn: string | null
  /** Códigos de idioma de Open Library ('spa', 'eng'...). */
  languages: string[]
  cover_url: string | null
  /** 'Paperback', 'Hardcover'... */
  format: string | null
}

const LANGUAGE_NAMES: Record<string, string> = {
  spa: 'Español',
  eng: 'Inglés',
  fre: 'Francés',
  ger: 'Alemán',
  ita: 'Italiano',
  por: 'Portugués',
  cat: 'Catalán',
  lat: 'Latín',
  rus: 'Ruso',
  jpn: 'Japonés',
}

/** Idiomas de la edición, con nombre en español (el código si no se conoce). */
export function editionLanguages(edition: Pick<BookEdition, 'languages'>): string {
  return edition.languages.map((l) => LANGUAGE_NAMES[l] ?? l.toUpperCase()).join(', ')
}

const FORMAT_NAMES: Record<string, string> = {
  paperback: 'Tapa blanda',
  hardcover: 'Tapa dura',
  'mass market paperback': 'Bolsillo',
  'trade paperback': 'Tapa blanda',
  'audio cd': 'Audiolibro',
  ebook: 'eBook',
}

/** Formato de la edición en español (como lo trae Open Library si no se conoce). */
export function editionFormat(edition: Pick<BookEdition, 'format'>): string | null {
  if (!edition.format) return null
  return FORMAT_NAMES[edition.format.toLowerCase()] ?? edition.format
}

/** Editorial y año de la edición ("Salamandra · 2000"), o nada si no trae. */
export function editionLabel(edition: Pick<BookEdition, 'publisher' | 'year' | 'publish_date'>): string {
  return [edition.publisher, edition.year ?? edition.publish_date].filter(Boolean).join(' · ')
}

/**
 * Lo que cambia al quedarse con una edición: páginas, ISBN y editorial (y la
 * portada, si se pide y la edición tiene). Lo que la edición no trae queda
 * como estaba. Un libro leído sigue con todas las páginas; uno en curso no
 * pasa del nuevo total.
 */
export function editionChanges(item: Item, edition: BookEdition, withCover: boolean): ItemWrite {
  const changes: ItemWrite = {
    metadata: {
      ...item.metadata,
      ...(edition.isbn ? { isbn: edition.isbn } : {}),
      ...(edition.publisher ? { publisher: edition.publisher } : {}),
    },
  }
  if (edition.pages) {
    changes.progress_total = edition.pages
    if (item.status === 'completed') changes.progress = edition.pages
    else if (item.progress > edition.pages) changes.progress = edition.pages
  }
  if (withCover && edition.cover_url) changes.cover_url = edition.cover_url
  return changes
}
