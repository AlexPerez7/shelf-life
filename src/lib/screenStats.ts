// Los números de la biblioteca de Pantalla, para la línea de resumen de arriba.

import { formatMinutes } from './media'
import type { Item } from '../types/item'

export interface StatPart {
  value: string
  label: string
}

/**
 * Resumen en pocas palabras ("3 títulos · 2 películas vistas · 170 episodios"):
 * lo que está en cero no se muestra, salvo los títulos.
 */
export function screenStats(items: Item[]): StatPart[] {
  const minutes = items.reduce((s, i) => s + i.time_spent_minutes, 0)
  const movies = items.filter((i) => i.media_type === 'movie' && i.status === 'completed').length
  const episodes = items.filter((i) => i.media_type !== 'movie').reduce((s, i) => s + i.progress, 0)
  const watching = items.filter((i) => i.status === 'in_progress').length
  const count = (n: number, one: string, many: string): StatPart => ({
    value: n.toLocaleString('es'),
    label: n === 1 ? one : many,
  })

  return [
    count(items.length, 'título', 'títulos'),
    watching > 0 && count(watching, 'viendo', 'viendo'),
    movies > 0 && count(movies, 'película vista', 'películas vistas'),
    episodes > 0 && count(episodes, 'episodio', 'episodios'),
    minutes > 0 && { value: formatMinutes(minutes), label: 'frente a la pantalla' },
  ].filter((p): p is StatPart => p !== false)
}
