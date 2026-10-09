// Listas del tracker de libros (como en Openreads): cada libro cae en una
// según su estado. Viven en la URL (?lista=...) para que la barra inferior y
// las pestañas de la biblioteca compartan el mismo estado.

import type { ItemStatus } from '../../types/item'

export type BookList = 'todos' | 'leyendo' | 'por-leer' | 'leidos' | 'abandonados'

export const bookListParam = 'lista'

export const bookLists: { id: BookList; label: string; statuses: ItemStatus[] | null }[] = [
  { id: 'todos', label: 'Todos', statuses: null },
  { id: 'leyendo', label: 'Leyendo', statuses: ['in_progress', 'paused'] },
  { id: 'por-leer', label: 'Por leer', statuses: ['wishlist', 'planned'] },
  { id: 'leidos', label: 'Leídos', statuses: ['completed'] },
  { id: 'abandonados', label: 'Abandonados', statuses: ['dropped'] },
]

export function isBookList(value: string | null): value is BookList {
  return bookLists.some((l) => l.id === value)
}
