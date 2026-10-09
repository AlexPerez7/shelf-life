import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildHistory } from './history'
import { makeItem } from '../test/factories'
import type { ActivityRow } from './stats'

/** Un registro de actividad a cierta hora local. */
function row(itemId: string, local: Date, delta: number | null, minutes: number | null): ActivityRow {
  return {
    id: `${itemId}-${local.getTime()}-${delta}`,
    item_id: itemId,
    occurred_at: local.toISOString(),
    progress_delta: delta,
    duration_minutes: minutes,
  }
}

describe('buildHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 9, 20, 0)) // 9 de octubre de 2026, 20:00 local
  })
  afterEach(() => vi.useRealTimers())

  const today = (h: number) => new Date(2026, 9, 9, h, 0)
  const yesterday = (h: number) => new Date(2026, 9, 8, h, 0)

  it('junta la actividad de un mismo título en un mismo día y suma el tiempo', () => {
    const series = makeItem({ id: 's', media_type: 'series', title: 'Frieren', created_at: '2025-01-01T12:00:00Z' })
    const days = buildHistory(
      [series],
      [row('s', today(10), 1, 24), row('s', today(11), 1, 24), row('s', today(12), 1, 24)]
    )
    const day = days.find((d) => d.label === 'Hoy')!
    const activity = day.events.filter((e) => e.kind === 'activity')
    expect(activity).toHaveLength(1)
    expect(activity[0].text).toBe('Viste 3 episodios de')
    expect(activity[0].detail).toBe('1h 12m')
    expect(day.minutes).toBe(72)
  })

  it('separa los días y los etiqueta "Hoy" y "Ayer", del más reciente al más viejo', () => {
    const book = makeItem({ id: 'b', media_type: 'book', created_at: '2025-01-01T12:00:00Z' })
    const days = buildHistory([book], [row('b', yesterday(21), 30, 40), row('b', today(9), 20, null)])
    expect(days.slice(0, 2).map((d) => d.label)).toEqual(['Hoy', 'Ayer'])
    expect(days[0].events[0].text).toBe('Leíste 20 páginas de')
    expect(days[1].events[0].detail).toBe('40m')
  })

  it('una película vista aparece una sola vez (actividad y fecha de fin el mismo día)', () => {
    const movie = makeItem({
      id: 'm',
      media_type: 'movie',
      status: 'completed',
      date_finished: '2026-10-09',
      created_at: '2025-01-01T12:00:00Z',
    })
    const days = buildHistory([movie], [row('m', today(15), null, 120)])
    const events = days.find((d) => d.label === 'Hoy')!.events
    expect(events.map((e) => e.kind)).toEqual(['activity'])
    expect(events[0].text).toBe('Viste')
  })

  it('en un día, terminar queda arriba y empezar abajo de la actividad', () => {
    const series = makeItem({
      id: 's2',
      media_type: 'anime',
      status: 'completed',
      date_started: '2026-10-09',
      date_finished: '2026-10-09',
      created_at: '2025-01-01T12:00:00Z',
    })
    const days = buildHistory([series], [row('s2', today(14), 12, 288)])
    expect(days[0].events.map((e) => e.kind)).toEqual(['finished', 'activity', 'started'])
  })

  it('ignora actividad de títulos que ya no están', () => {
    expect(buildHistory([], [row('borrado', today(10), 1, 20)])).toEqual([])
  })
})
