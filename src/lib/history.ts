// Historial de Pantalla y Libros: la actividad registrada (episodios,
// películas, páginas) junto con los hitos de cada ítem (agregado, empezado,
// terminado), agrupados por día.

import { parseDate } from './dates'
import { formatMinutes } from './media'
import { plural } from './text'
import type { ActivityRow } from './stats'
import type { Item } from '../types/item'

export type HistoryKind = 'activity' | 'added' | 'started' | 'finished'

export interface HistoryEvent {
  key: string
  kind: HistoryKind
  item: Item
  /** Para ordenar dentro del día. */
  time: number
  /** "Viste 3 episodios de", "Empezaste"... (el título va aparte). */
  text: string
  /** Detalle chico: tiempo, páginas. */
  detail: string | null
  minutes: number
}

export interface HistoryDay {
  key: string
  label: string
  minutes: number
  events: HistoryEvent[]
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** "Hoy", "Ayer", "lunes 6 de octubre" (con el año si no es el actual). */
function dayLabel(d: Date) {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(d) === dayKey(today)) return 'Hoy'
  if (dayKey(d) === dayKey(yesterday)) return 'Ayer'
  return d.toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  })
}

/** Texto de la actividad de un ítem en un día (varias filas sumadas). */
function activityText(item: Item, count: number, delta: number) {
  if (item.media_type === 'book') {
    return delta > 0 ? `Leíste ${plural(delta, 'página')} de` : 'Leíste'
  }
  if (item.media_type === 'movie') return count > 1 ? `Viste ${count} veces` : 'Viste'
  return delta > 0 ? `Viste ${plural(delta, 'episodio')} de` : 'Viste'
}

function finishedText(item: Item) {
  if (item.media_type === 'book') return 'Terminaste de leer'
  if (item.media_type === 'movie') return 'Viste'
  return 'Terminaste'
}

/**
 * Arma el historial, del día más reciente al más viejo. La actividad de un
 * mismo ítem en un mismo día se junta en un solo evento ("Viste 3 episodios
 * de..."). Una película marcada como vista registra actividad y fecha de fin
 * el mismo día: se muestra una sola vez.
 */
export function buildHistory(items: Item[], activity: ActivityRow[]): HistoryDay[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const events: HistoryEvent[] = []

  // Actividad, agrupada por ítem y día.
  const groups = new Map<string, { item: Item; rows: ActivityRow[]; date: Date }>()
  for (const row of activity) {
    const item = byId.get(row.item_id)
    if (!item) continue
    const date = parseDate(row.occurred_at)
    const key = `${row.item_id}:${dayKey(date)}`
    const group = groups.get(key)
    if (group) {
      group.rows.push(row)
      if (date > group.date) group.date = date
    } else {
      groups.set(key, { item, rows: [row], date })
    }
  }
  for (const [key, { item, rows, date }] of groups) {
    const delta = rows.reduce((s, r) => s + Math.max(0, r.progress_delta ?? 0), 0)
    const minutes = rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)
    // Las correcciones (retroceder) no se registran; si todo es cero no hay nada que contar.
    if (delta === 0 && minutes === 0 && item.media_type !== 'movie') continue
    events.push({
      key: `activity:${key}`,
      kind: 'activity',
      item,
      time: date.getTime(),
      text: activityText(item, rows.length, delta),
      detail: minutes > 0 ? formatMinutes(minutes) : null,
      minutes,
    })
  }

  // Hitos de cada ítem. Las fechas de inicio y fin son solo-fecha: van al
  // final del día para quedar arriba de la actividad de ese día.
  const endOfDay = (value: string) => {
    const d = parseDate(value)
    d.setHours(23, 59, 0, 0)
    return d
  }
  for (const item of items) {
    const added = parseDate(item.created_at)
    events.push({
      key: `added:${item.id}`,
      kind: 'added',
      item,
      time: added.getTime(),
      text: 'Agregaste',
      detail: null,
      minutes: 0,
    })
    if (item.date_started && item.media_type !== 'movie') {
      events.push({
        key: `started:${item.id}`,
        kind: 'started',
        item,
        // Antes que la actividad del día: empezar va primero.
        time: parseDate(item.date_started).getTime(),
        text: item.media_type === 'book' ? 'Empezaste a leer' : 'Empezaste',
        detail: null,
        minutes: 0,
      })
    }
    if (item.date_finished && item.status === 'completed') {
      const finished = endOfDay(item.date_finished)
      if (item.media_type === 'movie' && groups.has(`${item.id}:${dayKey(finished)}`)) continue
      events.push({
        key: `finished:${item.id}`,
        kind: 'finished',
        item,
        time: finished.getTime(),
        text: finishedText(item),
        detail: null,
        minutes: 0,
      })
    }
  }

  events.sort((a, b) => b.time - a.time)

  const days: HistoryDay[] = []
  for (const e of events) {
    const d = new Date(e.time)
    const key = dayKey(d)
    let day = days[days.length - 1]
    if (!day || day.key !== key) {
      day = { key, label: dayLabel(d), minutes: 0, events: [] }
      days.push(day)
    }
    day.events.push(e)
    day.minutes += e.minutes
  }
  return days
}
