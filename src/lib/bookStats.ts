// Estadísticas de libros por año: cada lectura terminada (las anteriores de
// `metadata.readings` y la última si está leído) cuenta en el año en que se
// terminó, y de ahí salen la meta de páginas, los promedios y lo más rápido
// y lo más lento.

import type { Item } from '../types/item'
import { parseDate } from './dates'
import { pastReadings, readingDays } from './readings'
import { yearBuckets, type MonthBucket } from './stats'

/** Una lectura terminada en un año. */
export interface YearReading {
  item: Item
  /** 'YYYY-MM-DD' */
  finished: string
  /** Días que tomó, si tiene las dos fechas. */
  days: number | null
}

/** Páginas de un libro leído: las de la edición, o hasta donde llegó. */
export const bookPages = (b: Pick<Item, 'progress_total' | 'progress'>) => b.progress_total ?? b.progress

/** Las lecturas terminadas en el año, una por cada vez que se terminó un libro. */
export function readingsInYear(books: Item[], year: number): YearReading[] {
  const inYear = (d: string | null): d is string => d != null && parseDate(d).getFullYear() === year
  const list: YearReading[] = []
  for (const item of books) {
    for (const r of pastReadings(item)) {
      if (inYear(r.finished)) list.push({ item, finished: r.finished, days: readingDays(r) })
    }
    if (item.status === 'completed' && inYear(item.date_finished)) {
      list.push({
        item,
        finished: item.date_finished,
        days: readingDays({ started: item.date_started, finished: item.date_finished }),
      })
    }
  }
  return list
}

/** Páginas de los libros terminados en el año (lo que cuenta la meta de páginas). */
export function pagesInYear(books: Item[], year: number) {
  return readingsInYear(books, year).reduce((sum, r) => sum + bookPages(r.item), 0)
}

/** Libros terminados en cada mes del año. */
export function finishedByMonth(readings: YearReading[], year: number): MonthBucket[] {
  return yearBuckets(readings, year, (r) => r.finished, () => 1)
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)

export interface YearAverages {
  /** Puntaje de 0 a 5, con un decimal. */
  rating: number | null
  pages: number | null
  /** Minutos de lectura por libro (solo con los que tienen tiempo registrado). */
  minutes: number | null
  days: number | null
}

/** Promedios de las lecturas terminadas en un año; `null` si no hay datos para uno. */
export function yearAverages(readings: YearReading[]): YearAverages {
  const rating = average(readings.flatMap((r) => (r.item.rating != null ? [r.item.rating / 2] : [])))
  const pages = average(readings.map((r) => bookPages(r.item)).filter((p) => p > 0))
  const minutes = average(readings.map((r) => r.item.time_spent_minutes).filter((m) => m > 0))
  const days = average(readings.flatMap((r) => (r.days != null ? [r.days] : [])))
  return {
    rating: rating == null ? null : Math.round(rating * 10) / 10,
    pages: pages == null ? null : Math.round(pages),
    minutes: minutes == null ? null : Math.round(minutes),
    days: days == null ? null : Math.round(days),
  }
}

/** La lectura más rápida y la más lenta del año (entre las que tienen las dos fechas). */
export function fastestAndSlowest(readings: YearReading[]) {
  const timed = readings.filter((r): r is YearReading & { days: number } => r.days != null && r.days > 0)
  if (timed.length === 0) return { fastest: null, slowest: null }
  const fastest = timed.reduce((a, b) => (b.days < a.days ? b : a))
  const slowest = timed.reduce((a, b) => (b.days > a.days ? b : a))
  // Con una sola lectura (o todas iguales) no hay un "más lento".
  return { fastest, slowest: slowest.days > fastest.days ? slowest : null }
}
