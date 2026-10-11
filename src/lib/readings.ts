// Lecturas de un libro (idea de Openreads): cada vez que se leyó, con su
// inicio y su fin. La lectura actual (o la última) es la de siempre:
// `date_started` / `date_finished` del ítem. Las anteriores van en
// `metadata.readings`, de la más vieja a la más nueva. `replays` sigue
// contando las lecturas anteriores (incluye las importadas sin fechas).

import type { Item, ItemWrite } from '../types/item'
import { parseDate } from './dates'

export interface Reading {
  /** 'YYYY-MM-DD' */
  started: string | null
  /** 'YYYY-MM-DD' */
  finished: string | null
}

/** Lecturas anteriores con fechas, de la más vieja a la más nueva. */
export function pastReadings(item: Pick<Item, 'metadata'>): Reading[] {
  return Array.isArray(item.metadata.readings) ? item.metadata.readings : []
}

/** Fechas en que se terminó el libro: las anteriores y la última si está leído. */
export function finishedDates(item: Pick<Item, 'metadata' | 'status' | 'date_finished'>): string[] {
  const dates = pastReadings(item).flatMap((r) => (r.finished ? [r.finished] : []))
  if (item.status === 'completed' && item.date_finished) dates.push(item.date_finished)
  return dates
}

/** Veces que se terminó (cuenta también las relecturas importadas sin fechas). */
export function timesRead(item: Pick<Item, 'metadata' | 'status' | 'date_finished' | 'replays'>): number {
  const current = item.status === 'completed' ? 1 : 0
  return Math.max(finishedDates(item).length, item.replays + current)
}

/** ¿Lo terminó (alguna vez) en ese año? */
export function finishedInYear(item: Pick<Item, 'metadata' | 'status' | 'date_finished'>, year: number) {
  return finishedDates(item).some((d) => parseDate(d).getFullYear() === year)
}

/** La última fecha de fin en ese año (para ordenar "Leídos en 2026"). */
export function lastFinishIn(item: Pick<Item, 'metadata' | 'status' | 'date_finished'>, year: number) {
  return (
    finishedDates(item)
      .filter((d) => parseDate(d).getFullYear() === year)
      .sort()
      .pop() ?? null
  )
}

/** Días que tomó una lectura (contando los dos extremos), si tiene las dos fechas. */
export function readingDays(r: Reading): number | null {
  if (!r.started || !r.finished) return null
  const ms = parseDate(r.finished).getTime() - parseDate(r.started).getTime()
  return ms < 0 ? null : Math.round(ms / 86_400_000) + 1
}

const byStart = (a: Reading, b: Reading) => (a.started ?? a.finished ?? '').localeCompare(b.started ?? b.finished ?? '')

/**
 * Releer: la lectura terminada pasa al historial y empieza una nueva hoy,
 * desde la página 0.
 */
export function rereadChanges(item: Item, today: string): ItemWrite {
  const done: Reading = { started: item.date_started, finished: item.date_finished }
  const readings = done.started || done.finished ? [...pastReadings(item), done].sort(byStart) : pastReadings(item)
  return {
    status: 'in_progress',
    progress: 0,
    replays: item.replays + 1,
    date_started: today,
    date_finished: null,
    metadata: { ...item.metadata, readings },
  }
}

/** Suma una lectura anterior (un libro leído antes de usar la app). */
export function addReadingChanges(item: Item, reading: Reading): ItemWrite {
  return {
    replays: item.replays + 1,
    metadata: { ...item.metadata, readings: [...pastReadings(item), reading].sort(byStart) },
  }
}

/** Cambia las fechas de una lectura anterior. */
export function editReadingChanges(item: Item, index: number, reading: Reading): ItemWrite {
  const readings = pastReadings(item).map((r, i) => (i === index ? reading : r)).sort(byStart)
  return { metadata: { ...item.metadata, readings } }
}

/** Borra una lectura anterior. */
export function removeReadingChanges(item: Item, index: number): ItemWrite {
  return {
    replays: Math.max(0, item.replays - 1),
    metadata: { ...item.metadata, readings: pastReadings(item).filter((_, i) => i !== index) },
  }
}
