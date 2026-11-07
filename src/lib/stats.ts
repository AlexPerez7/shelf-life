// Cálculos de las estadísticas de los tres trackers, a partir de `items` y
// de `activity_log`.

import { finishedInYear } from './readings'
import { parseDate } from './dates'
import type { Item } from '../types/item'

/** Un registro de actividad: episodios, películas o páginas, con su tiempo. */
export interface ActivityRow {
  id: string
  item_id: string
  occurred_at: string
  duration_minutes: number | null
  progress_delta: number | null
}

export interface MonthBucket {
  key: string
  /** "oct" */
  short: string
  /** "octubre de 2026" */
  long: string
  value: number
}

/** `count` meses seguidos desde `first`, todos en cero. */
function emptyBuckets(first: Date, count: number): MonthBucket[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(first.getFullYear(), first.getMonth() + i, 1)
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      short: d.toLocaleDateString('es', { month: 'short' }).replace('.', ''),
      long: d.toLocaleDateString('es', { month: 'long', year: 'numeric' }),
      value: 0,
    }
  })
}

/** Suma `valueOf` de cada fila en el mes de su fecha (las fuera de rango se ignoran). */
function fillBuckets<T>(
  list: MonthBucket[],
  rows: T[],
  dateOf: (row: T) => string,
  valueOf: (row: T) => number
) {
  const byKey = new Map(list.map((m) => [m.key, m]))
  for (const row of rows) {
    const d = parseDate(dateOf(row))
    const bucket = byKey.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (bucket) bucket.value += valueOf(row)
  }
  return list
}

/** Los últimos `count` meses (el actual al final), sumando `valueOf` de cada registro. */
export function monthBuckets(
  activity: ActivityRow[],
  count: number,
  valueOf: (row: ActivityRow) => number
): MonthBucket[] {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() - (count - 1), 1)
  return fillBuckets(emptyBuckets(first, count), activity, (r) => r.occurred_at, valueOf)
}

/** Los 12 meses de un año (enero a diciembre), sumando `valueOf` de cada fila según su fecha. */
export function yearBuckets<T>(
  rows: T[],
  year: number,
  dateOf: (row: T) => string,
  valueOf: (row: T) => number
): MonthBucket[] {
  return fillBuckets(emptyBuckets(new Date(year, 0, 1), 12), rows, dateOf, valueOf)
}

/** Los `limit` valores más repetidos, de mayor a menor. */
export function topCounts(values: string[], limit: number): { label: string; value: number }[] {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }))
}

/** Lo que se empezó (todo menos "quiero" y "pendiente"): base de géneros y autores. */
export function started(items: Item[]) {
  return items.filter((i) => i.status !== 'wishlist' && i.status !== 'planned')
}

/**
 * Ítems terminados en un año (por fecha de fin). Un libro releído cuenta en
 * cada año en que se terminó una de sus lecturas (lib/readings.ts).
 */
export function finishedIn(items: Item[], year: number) {
  return items.filter((i) => finishedInYear(i, year))
}

/** El ítem con más valor (puntaje, tiempo...), o nada si ninguno tiene. */
export function maxBy(items: Item[], valueOf: (item: Item) => number | null) {
  let best: Item | null = null
  let bestValue = 0
  for (const i of items) {
    const v = valueOf(i)
    if (v != null && v > bestValue) {
      best = i
      bestValue = v
    }
  }
  return best
}

/** El ítem con menos valor (positivo), o nada si ninguno tiene. */
export function minBy(items: Item[], valueOf: (item: Item) => number | null) {
  let best: Item | null = null
  let bestValue = Infinity
  for (const i of items) {
    const v = valueOf(i)
    if (v != null && v > 0 && v < bestValue) {
      best = i
      bestValue = v
    }
  }
  return best
}
