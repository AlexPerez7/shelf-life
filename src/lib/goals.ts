// Metas del año (tabla `goals`, migración 0012): una por tracker. El avance
// se calcula acá, con lo terminado en el año.

import { parseDate } from './dates'
import type { TrackerId } from '../trackers/trackers'
import type { Game } from '../types/game'
import type { Item } from '../types/item'

export interface Goal {
  tracker: TrackerId
  year: number
  target: number
}

/** Qué cuenta cada meta: [singular, plural]. */
export const goalUnits: Record<TrackerId, [string, string]> = {
  juegos: ['juego terminado', 'juegos terminados'],
  pantalla: ['título visto', 'títulos vistos'],
  libros: ['libro leído', 'libros leídos'],
}

const inYear = (date: string | null, year: number) => date != null && parseDate(date).getFullYear() === year

/** Cuánto lleva cumplido una meta: lo terminado con fecha de fin en ese año. */
export function goalDone(tracker: TrackerId, year: number, games: Game[], items: Item[]) {
  if (tracker === 'juegos') {
    return games.filter((g) => g.status === 'completado' && inYear(g.date_finished, year)).length
  }
  return items.filter(
    (i) =>
      i.status === 'completed' &&
      inYear(i.date_finished, year) &&
      (tracker === 'libros' ? i.media_type === 'book' : i.media_type !== 'book' && i.media_type !== 'game')
  ).length
}

/**
 * Cómo va la meta respecto de lo esperado a esta altura del año: positivo
 * es adelantado, negativo atrasado (en unidades enteras).
 */
export function goalPace(goal: Goal, done: number, now = new Date()) {
  if (goal.year !== now.getFullYear()) return null
  const start = new Date(goal.year, 0, 1).getTime()
  const end = new Date(goal.year + 1, 0, 1).getTime()
  const expected = (goal.target * (now.getTime() - start)) / (end - start)
  return Math.floor(done - expected)
}
