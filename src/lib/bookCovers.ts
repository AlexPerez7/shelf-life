// Completar portadas de libros que no tienen (típico después de importar de
// Goodreads o StoryGraph): la importación pone la portada de Open Library
// por ISBN con `?default=false`, que responde 404 si no existe.

import { callFn } from './functions'
import type { Item } from '../types/item'

/** Portada puesta al importar: puede no existir (404). */
export function isUncheckedCover(url: string | null): boolean {
  return url != null && url.includes('covers.openlibrary.org/b/isbn/') && url.includes('default=false')
}

/** La misma portada sin `default=false`, una vez que se comprobó que existe. */
export const checkedCover = (url: string) => url.replace(/[?&]default=false/, '')

/** Libros a revisar: sin portada, o con la de la importación sin comprobar. */
export function coverCandidates(books: Item[]) {
  return {
    missing: books.filter((b) => !b.cover_url),
    unchecked: books.filter((b) => isUncheckedCover(b.cover_url)),
  }
}

/** ¿La imagen carga? (en el navegador) */
export function imageLoads(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth > 1)
    img.onerror = () => resolve(false)
    img.src = url
  })
}

/** Tanda por llamada a la Edge Function. */
export const FIND_COVERS_BATCH = 20

/** Busca una portada para cada libro (mismo orden; `null` si no aparece). */
export async function findBookCovers(books: Item[]): Promise<(string | null)[]> {
  const result = await callFn<(string | null)[]>('media-search', {
    type: 'book',
    mode: 'findCovers',
    books: books.map((b) => ({ title: b.title, author: b.metadata.authors?.[0] ?? '', isbn: b.metadata.isbn ?? undefined })),
  })
  if (!Array.isArray(result) || result.length !== books.length) {
    throw new Error('La función de búsqueda está desactualizada: falta publicar media-search.')
  }
  return result
}

/** Corre `task` sobre cada elemento, de a `limit` a la vez. */
export async function eachLimited<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0
  const worker = async () => {
    while (next < items.length) await task(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}
