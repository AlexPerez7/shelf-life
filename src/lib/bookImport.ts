// Importar la biblioteca de libros desde el CSV que exportan Goodreads
// ("My Books → Import and export → Export library"), StoryGraph ("Manage
// account → Export StoryGraph library") o BookWyrm ("Import/Export → Export
// book data"). Todo se procesa en el dispositivo:
// el archivo no sale del navegador; solo se guardan los libros en `items`.

import type { Item, ItemStatus, ItemWrite } from '../types/item'
import { parseCsv } from './csv'

export type ImportSource = 'goodreads' | 'storygraph' | 'bookwyrm'

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

function bookwyrmStatus(shelf: string | undefined): ItemStatus {
  switch ((shelf ?? '').trim()) {
    case 'read':
      return 'completed'
    case 'reading':
      return 'in_progress'
    case 'to-read':
      return 'wishlist'
    case 'stopped-reading':
      return 'dropped'
    default:
      // Estantes propios: no dicen si se leyó o no.
      return 'planned'
  }
}

/** Qué estante manda cuando un libro está en varios (BookWyrm repite la fila por estante). */
const BOOKWYRM_SHELF_PRIORITY = ['read', 'reading', 'stopped-reading', 'to-read']

/** Las reseñas de BookWyrm vienen en HTML: se pasan a texto con párrafos. */
function htmlToText(v: string | undefined) {
  const text = (v ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
  return clean(text)
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

  if (col('author_text') >= 0 && col('shelf') >= 0 && col('title') >= 0) {
    // Un libro en varios estantes sale en varias filas: se junta en una, con
    // el estante de lectura que más dice (leído > leyendo > abandonado > por leer).
    const rank = (shelf: string | undefined) => {
      const i = BOOKWYRM_SHELF_PRIORITY.indexOf((shelf ?? '').trim())
      return i < 0 ? BOOKWYRM_SHELF_PRIORITY.length : i
    }
    const byBook = new Map<string, { row: string[]; book: ImportedBook }>()
    for (const r of rows) {
      const shelf = get(r, 'shelf')
      const status = bookwyrmStatus(shelf)
      const finish = cleanDate(get(r, 'finish_date'))
      const stopped = cleanDate(get(r, 'stopped_date'))
      const authors = splitAuthors(get(r, 'author_text'))
      const isbn = cleanIsbn(get(r, 'isbn_13')) ?? cleanIsbn(get(r, 'isbn_10'))
      const title = (get(r, 'title') ?? '').trim()
      if (!title) continue
      const book: ImportedBook = {
        title,
        authors,
        isbn,
        status,
        // BookWyrm puntúa de 1 a 5 estrellas enteras.
        rating: rating(get(r, 'rating')),
        pages: null,
        year: null,
        publisher: null,
        format: null,
        dateRead: status === 'dropped' ? (stopped ?? finish) : (finish ?? stopped),
        dateAdded: cleanDate(get(r, 'shelf_date')),
        review: htmlToText(get(r, 'review_content')),
        notes: null,
        rereads: 0,
      }
      const key = bookKey(title, authors, isbn)
      const prev = byBook.get(key)
      if (!prev || rank(shelf) < rank(get(prev.row, 'shelf'))) {
        // Lo que el estante ganador no trae (puntaje, reseña) se rescata de la otra fila.
        byBook.set(key, {
          row: r,
          book: {
            ...book,
            rating: book.rating ?? prev?.book.rating ?? null,
            review: book.review ?? prev?.book.review ?? null,
            dateAdded: book.dateAdded ?? prev?.book.dateAdded ?? null,
          },
        })
      } else {
        prev.book.rating ??= book.rating
        prev.book.review ??= book.review
      }
    }
    return { source: 'bookwyrm', books: [...byBook.values()].map((v) => v.book) }
  }

  throw new Error('No reconocemos el archivo: tiene que ser el CSV que exporta Goodreads, StoryGraph o BookWyrm.')
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
