// Importar la biblioteca de libros desde el CSV que exportan Goodreads
// ("My Books → Import and export → Export library") o StoryGraph ("Manage
// account → Export StoryGraph library"). Todo se procesa en el dispositivo:
// el archivo no sale del navegador; solo se guardan los libros en `items`.

import type { Item, ItemStatus, ItemWrite } from '../types/item'
import { parseCsv } from './csv'

export type ImportSource = 'goodreads' | 'storygraph'

export interface ImportedBook {
  title: string
  authors: string[]
  isbn: string | null
  status: ItemStatus
  /** 1-10, como en la app (las otras usan 1-5 estrellas). */
  rating: number | null
  pages: number | null
  year: string | null
  publisher: string | null
  format: string | null
  dateRead: string | null
  dateAdded: string | null
  review: string | null
  notes: string | null
  rereads: number
}

const clean = (v: string | undefined) => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

/** Goodreads exporta los ISBN como ="0439023483". */
function cleanIsbn(v: string | undefined) {
  const digits = (v ?? '').replace(/[^0-9Xx]/g, '').toUpperCase()
  return digits.length === 10 || digits.length === 13 ? digits : null
}

/** "2023/05/14" o "2023-05-14" -> "2023-05-14". */
function cleanDate(v: string | undefined) {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec((v ?? '').trim())
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

function positiveInt(v: string | undefined) {
  const n = Number.parseInt((v ?? '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Estrellas (0-5, con decimales en StoryGraph) -> 1-10; 0 es "sin puntaje". */
function rating(v: string | undefined) {
  const n = Number.parseFloat((v ?? '').trim())
  return Number.isFinite(n) && n > 0 ? Math.min(10, Math.max(1, Math.round(n * 2))) : null
}

/** Encuadernación / formato de la otra app -> formatos de la app. */
function format(v: string | undefined): string | null {
  const t = (v ?? '').toLowerCase()
  if (!t) return null
  if (t.includes('kindle')) return 'Kindle'
  if (t.includes('kobo')) return 'Kobo'
  if (t.includes('audio') || t.includes('audible')) return 'Audiolibro'
  if (t.includes('ebook') || t.includes('digital') || t.includes('epub')) return 'eBook'
  if (/paperback|hardcover|mass market|tapa|bolsillo|board|library binding|print|physical/.test(t)) return 'Físico'
  return null
}

function goodreadsStatus(shelf: string | undefined): ItemStatus {
  switch ((shelf ?? '').trim()) {
    case 'read':
      return 'completed'
    case 'currently-reading':
      return 'in_progress'
    case 'to-read':
      return 'wishlist'
    default:
      // Estantes exclusivos propios (ej. "did-not-finish", "abandonados").
      return /dnf|did-not-finish|abandon/.test(shelf ?? '') ? 'dropped' : 'planned'
  }
}

function storygraphStatus(status: string | undefined): ItemStatus {
  switch ((status ?? '').trim()) {
    case 'read':
      return 'completed'
    case 'currently-reading':
      return 'in_progress'
    case 'to-read':
      return 'wishlist'
    case 'did-not-finish':
      return 'dropped'
    case 'paused':
      return 'paused'
    default:
      return 'planned'
  }
}

/** Separa autores ("A, B" o "A & B"), sin vacíos ni repetidos. */
function splitAuthors(...values: (string | undefined)[]) {
  const all = values.flatMap((v) => (v ?? '').split(/,|&/)).map((a) => a.trim()).filter(Boolean)
  return [...new Set(all)]
}

/**
 * Lee el CSV exportado y devuelve los libros. Reconoce la app por los
 * encabezados; si no es ninguna, lanza un error con un mensaje para mostrar.
 */
export function parseBookExport(text: string): { source: ImportSource; books: ImportedBook[] } {
  const [header, ...rows] = parseCsv(text)
  if (!header) throw new Error('El archivo está vacío.')
  const col = (name: string) => header.findIndex((h) => h.trim() === name)
  const get = (row: string[], name: string) => {
    const i = col(name)
    return i >= 0 ? row[i] : undefined
  }

  if (col('Exclusive Shelf') >= 0 && col('Title') >= 0) {
    const books = rows.map((r) => ({
      title: (get(r, 'Title') ?? '').trim(),
      authors: splitAuthors(get(r, 'Author'), get(r, 'Additional Authors')),
      isbn: cleanIsbn(get(r, 'ISBN13')) ?? cleanIsbn(get(r, 'ISBN')),
      status: goodreadsStatus(get(r, 'Exclusive Shelf')),
      rating: rating(get(r, 'My Rating')),
      pages: positiveInt(get(r, 'Number of Pages')),
      year: clean(get(r, 'Original Publication Year')) ?? clean(get(r, 'Year Published')),
      publisher: clean(get(r, 'Publisher')),
      format: format(get(r, 'Binding')),
      dateRead: cleanDate(get(r, 'Date Read')),
      dateAdded: cleanDate(get(r, 'Date Added')),
      review: clean(get(r, 'My Review'))?.replace(/<br\s*\/?>/gi, '\n') ?? null,
      notes: clean(get(r, 'Private Notes')),
      rereads: Math.max(0, (positiveInt(get(r, 'Read Count')) ?? 1) - 1),
    }))
    return { source: 'goodreads', books: books.filter((b) => b.title) }
  }

  if (col('Read Status') >= 0 && col('Title') >= 0) {
    const books = rows.map((r) => {
      // "Dates Read" puede traer varias lecturas ("2021/01/02-2021/01/20, ...").
      const lastRead = cleanDate(get(r, 'Last Date Read'))
      return {
        title: (get(r, 'Title') ?? '').trim(),
        authors: splitAuthors(get(r, 'Authors')),
        isbn: cleanIsbn(get(r, 'ISBN/UID')),
        status: storygraphStatus(get(r, 'Read Status')),
        rating: rating(get(r, 'Star Rating')),
        pages: null,
        year: null,
        publisher: null,
        format: format(get(r, 'Format')),
        dateRead: lastRead,
        dateAdded: cleanDate(get(r, 'Date Added')),
        review: clean(get(r, 'Review')),
        notes: null,
        rereads: Math.max(0, (positiveInt(get(r, 'Read Count')) ?? 1) - 1),
      }
    })
    return { source: 'storygraph', books: books.filter((b) => b.title) }
  }

  throw new Error('No reconocemos el archivo: tiene que ser el CSV que exporta Goodreads o StoryGraph.')
}

/** Clave para no duplicar: ISBN si hay; si no, título + primer autor. */
export function bookKey(title: string, authors: string[] | undefined, isbn: string | null | undefined) {
  if (isbn) return `isbn:${isbn}`
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\(.*?\)|[:].*$/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  return `t:${norm(title)}|${norm(authors?.[0] ?? '')}`
}

/** Claves de los libros que ya están en el librero (por ISBN y por título + autor). */
export function existingBookKeys(books: Item[]) {
  const keys = new Set<string>()
  for (const b of books) {
    if (b.metadata.isbn) keys.add(bookKey(b.title, b.metadata.authors, b.metadata.isbn))
    keys.add(bookKey(b.title, b.metadata.authors, null))
  }
  return keys
}

export function isDuplicate(book: ImportedBook, keys: Set<string>) {
  return (
    (book.isbn != null && keys.has(bookKey(book.title, book.authors, book.isbn))) ||
    keys.has(bookKey(book.title, book.authors, null))
  )
}

/** Libro importado -> fila de `items`. La portada sale de Open Library por ISBN. */
export function importedToItem(b: ImportedBook): ItemWrite & Pick<Item, 'media_type' | 'title'> & { created_at?: string } {
  const completed = b.status === 'completed'
  return {
    media_type: 'book',
    title: b.title,
    status: b.status,
    rating: b.rating,
    // `default=false`: sin portada responde 404 y se ve el título en la tapa.
    cover_url: b.isbn ? `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg?default=false` : null,
    release_date: b.year && /^\d{4}$/.test(b.year) ? `${b.year}-01-01` : null,
    progress_total: b.pages,
    progress: completed && b.pages ? b.pages : 0,
    date_finished: completed ? b.dateRead : null,
    review: b.review,
    notes: b.notes,
    replays: b.rereads,
    format: b.format,
    metadata: {
      ...(b.authors.length ? { authors: b.authors } : {}),
      ...(b.isbn ? { isbn: b.isbn } : {}),
      ...(b.publisher ? { publisher: b.publisher } : {}),
    },
    // Sin `source`/`external_id`: no vienen de una API de búsqueda.
    // Conserva cuándo se agregó en la otra app (el historial lo muestra así).
    ...(b.dateAdded ? { created_at: `${b.dateAdded}T12:00:00` } : {}),
  }
}
