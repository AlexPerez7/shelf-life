/** Formatos de juegos. */
export const COMMON_FORMATS = ['Físico', 'Digital', 'Suscripción']

/** Formatos de libros: papel, eBook (y en qué lector) o audiolibro. Se pueden marcar varios. */
export const BOOK_FORMATS = ['Físico', 'eBook', 'Kindle', 'Kobo', 'Audiolibro']

/** Dónde se ve algo de Pantalla (va en el mismo campo `format`). Se pueden marcar varios. */
export const SCREEN_PLATFORMS = [
  'Netflix',
  'Max',
  'Disney+',
  'Prime Video',
  'Apple TV+',
  'Crunchyroll',
  'Cine',
  'TV',
  'Otro',
]

// Último formato usado al agregar un libro: quien lee casi todo en Kindle no
// tiene que marcarlo cada vez. Es una preferencia del dispositivo.
const LAST_BOOK_FORMAT_KEY = 'shelflife_last_book_format'

export function readLastBookFormat(): string {
  try {
    return localStorage.getItem(LAST_BOOK_FORMAT_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveLastBookFormat(format: string) {
  try {
    if (format) localStorage.setItem(LAST_BOOK_FORMAT_KEY, format)
    else localStorage.removeItem(LAST_BOOK_FORMAT_KEY)
  } catch {
    /* preferencia no guardada */
  }
}
