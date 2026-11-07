import { describe, expect, it } from 'vitest'
import { fastestAndSlowest, finishedByMonth, pagesInYear, readingsInYear, yearAverages } from './bookStats'
import { makeItem } from '../test/factories'

const done = (overrides = {}) =>
  makeItem({
    media_type: 'book',
    status: 'completed',
    date_started: '2026-01-01',
    date_finished: '2026-01-10',
    progress: 200,
    progress_total: 200,
    ...overrides,
  })

describe('lecturas del año', () => {
  it('cuenta cada vez que se terminó un libro en ese año, incluidas las relecturas', () => {
    const reread = done({
      title: 'Releído',
      date_started: '2026-05-01',
      date_finished: '2026-05-04',
      metadata: {
        readings: [
          { started: '2026-02-01', finished: '2026-02-11' },
          { started: '2024-01-01', finished: '2024-01-03' },
        ],
      },
    })
    const pending = makeItem({ media_type: 'book', status: 'in_progress', date_finished: '2026-03-01' })
    const readings = readingsInYear([reread, pending], 2026)
    expect(readings.map((r) => [r.finished, r.days])).toEqual([
      ['2026-02-11', 11],
      ['2026-05-04', 4],
    ])
    expect(readingsInYear([reread], 2024)).toHaveLength(1)
  })

  it('suma las páginas de lo terminado en el año', () => {
    const a = done({ progress_total: 300 })
    const b = done({ progress_total: null, progress: 150 })
    const old = done({ date_finished: '2025-01-01', progress_total: 999 })
    expect(pagesInYear([a, b, old], 2026)).toBe(450)
  })

  it('reparte lo terminado por mes', () => {
    const books = [
      done({ date_finished: '2026-01-10' }),
      done({ date_finished: '2026-01-30' }),
      done({ date_finished: '2026-03-02' }),
    ]
    const months = finishedByMonth(readingsInYear(books, 2026), 2026)
    expect(months).toHaveLength(12)
    expect(months.map((m) => m.value)).toEqual([2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })
})

describe('promedios y extremos', () => {
  const readings = readingsInYear(
    [
      done({ rating: 8, progress_total: 100, time_spent_minutes: 120, date_started: '2026-01-01', date_finished: '2026-01-02' }),
      done({ rating: 9, progress_total: 301, time_spent_minutes: 0, date_started: '2026-02-01', date_finished: '2026-02-20' }),
      done({ rating: null, progress_total: 200, date_started: null, date_finished: '2026-03-01' }),
    ],
    2026
  )

  it('promedia puntaje, páginas, tiempo y días ignorando lo que no tiene dato', () => {
    expect(yearAverages(readings)).toEqual({ rating: 4.3, pages: 200, minutes: 120, days: 11 })
    expect(yearAverages([])).toEqual({ rating: null, pages: null, minutes: null, days: null })
  })

  it('encuentra la lectura más rápida y la más lenta', () => {
    const { fastest, slowest } = fastestAndSlowest(readings)
    expect(fastest?.days).toBe(2)
    expect(slowest?.days).toBe(20)
  })

  it('con una sola lectura con fechas no hay "más lenta"', () => {
    expect(fastestAndSlowest(readings.slice(0, 1)).slowest).toBeNull()
    expect(fastestAndSlowest([])).toEqual({ fastest: null, slowest: null })
  })
})
