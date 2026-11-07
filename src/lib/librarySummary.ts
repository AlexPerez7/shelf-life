// Resumen de una línea de Libros y Juegos (como `screenStats` en Pantalla).

import type { StatPart } from './screenStats'
import type { Game } from '../types/game'
import type { Item } from '../types/item'

const num = (n: number, one: string, many: string): StatPart => ({
  value: n.toLocaleString('es'),
  label: n === 1 ? one : many,
})

/** "12 libros · 1 leyendo · 8 leídos · 3.200 páginas": lo que está en cero no se muestra, salvo los libros. */
export function bookSummary(books: Item[]): StatPart[] {
  const read = books.filter((b) => b.status === 'completed').length
  const reading = books.filter((b) => b.status === 'in_progress').length
  const pages = books.reduce(
    (s, b) => s + (b.status === 'completed' ? (b.progress_total ?? b.progress) : b.progress),
    0
  )
  return [
    num(books.length, 'libro', 'libros'),
    reading > 0 && num(reading, 'leyendo', 'leyendo'),
    read > 0 && num(read, 'leído', 'leídos'),
    pages > 0 && num(pages, 'página', 'páginas'),
  ].filter((p): p is StatPart => p !== false)
}

/** "40 juegos · 2 jugando · 15 completados · 320h jugadas": lo que está en cero no se muestra, salvo los juegos. */
export function gameSummary(games: Game[]): StatPart[] {
  const playing = games.filter((g) => g.status === 'jugando').length
  const done = games.filter((g) => g.status === 'completado').length
  const hours = Math.round(games.reduce((s, g) => s + g.hours_played, 0))
  return [
    num(games.length, 'juego', 'juegos'),
    playing > 0 && num(playing, 'jugando', 'jugando'),
    done > 0 && num(done, 'completado', 'completados'),
    hours > 0 && { value: `${hours.toLocaleString('es')}h`, label: 'jugadas' },
  ].filter((p): p is StatPart => p !== false)
}
