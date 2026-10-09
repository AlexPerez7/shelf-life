import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { finishedIn, maxBy, minBy, monthBuckets, started, topCounts } from './stats'
import { goalDone, goalPace } from './goals'
import { sizedCover } from './images'
import { makeGame, makeItem } from '../test/factories'

describe('topCounts', () => {
  it('cuenta, ordena de mayor a menor (empates por nombre) y corta', () => {
    expect(topCounts(['Drama', 'Acción', 'Drama', 'Comedia', 'Acción', 'Drama'], 2)).toEqual([
      { label: 'Drama', value: 3 },
      { label: 'Acción', value: 2 },
    ])
  })
})

describe('monthBuckets', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0)) // octubre de 2026
  })
  afterEach(() => vi.useRealTimers())

  it('suma por mes los últimos N meses, el actual al final', () => {
    const rows = [
      { id: '1', item_id: 'a', occurred_at: new Date(2026, 9, 2).toISOString(), duration_minutes: 30, progress_delta: 1 },
      { id: '2', item_id: 'a', occurred_at: new Date(2026, 9, 9).toISOString(), duration_minutes: 45, progress_delta: 1 },
      { id: '3', item_id: 'a', occurred_at: new Date(2026, 8, 20).toISOString(), duration_minutes: 10, progress_delta: 1 },
      // Fuera de la ventana: no suma.
      { id: '4', item_id: 'a', occurred_at: new Date(2025, 0, 1).toISOString(), duration_minutes: 99, progress_delta: 1 },
    ]
    const months = monthBuckets(rows, 3, (r) => r.duration_minutes ?? 0)
    expect(months.map((m) => m.value)).toEqual([0, 10, 75])
    expect(months[2].long).toMatch(/octubre/)
  })
})

describe('helpers de ítems', () => {
  it('started deja afuera lo que solo se quiere o está pendiente', () => {
    const items = [makeItem({ status: 'wishlist' }), makeItem({ status: 'planned' }), makeItem({ status: 'dropped' })]
    expect(started(items).map((i) => i.status)).toEqual(['dropped'])
  })

  it('finishedIn filtra por el año de la fecha de fin', () => {
    const items = [
      makeItem({ status: 'completed', date_finished: '2026-01-01' }),
      makeItem({ status: 'completed', date_finished: '2025-12-31' }),
      makeItem({ status: 'in_progress', date_finished: '2026-05-05' }),
    ]
    expect(finishedIn(items, 2026)).toHaveLength(1)
  })

  it('maxBy y minBy ignoran los que no tienen valor', () => {
    const a = makeItem({ progress_total: 100 })
    const b = makeItem({ progress_total: 800 })
    const c = makeItem({ progress_total: null })
    expect(maxBy([a, b, c], (i) => i.progress_total)).toBe(b)
    expect(minBy([a, b, c], (i) => i.progress_total)).toBe(a)
    expect(maxBy([c], (i) => i.progress_total)).toBeNull()
  })
})

describe('metas', () => {
  it('goalDone cuenta lo terminado ese año en cada tracker', () => {
    const games = [
      makeGame({ status: 'completado', date_finished: '2026-03-01' }),
      makeGame({ status: 'jugando', date_finished: null }),
    ]
    const items = [
      makeItem({ media_type: 'book', status: 'completed', date_finished: '2026-02-01' }),
      makeItem({ media_type: 'movie', status: 'completed', date_finished: '2026-02-01' }),
      makeItem({ media_type: 'series', status: 'completed', date_finished: '2025-02-01' }),
    ]
    expect(goalDone('juegos', 2026, games, items)).toBe(1)
    expect(goalDone('libros', 2026, games, items)).toBe(1)
    expect(goalDone('pantalla', 2026, games, items)).toBe(1)
  })

  it('goalPace: adelantado, al día o atrasado según el calendario', () => {
    const mid = new Date(2026, 6, 2) // ~mitad del año
    const goal = { tracker: 'libros' as const, year: 2026, target: 24 }
    expect(goalPace(goal, 12, mid)).toBe(0)
    expect(goalPace(goal, 15, mid)).toBe(3)
    expect(goalPace(goal, 9, mid)).toBeLessThan(0)
    // Otro año: no aplica.
    expect(goalPace({ ...goal, year: 2025 }, 9, mid)).toBeNull()
  })
})

describe('sizedCover', () => {
  it('pide al CDN el tamaño justo y deja igual lo que no conoce', () => {
    expect(sizedCover('https://image.tmdb.org/t/p/w500/a.jpg', 'thumb')).toBe('https://image.tmdb.org/t/p/w185/a.jpg')
    expect(sizedCover('https://image.tmdb.org/t/p/original/a.jpg', 'poster')).toBe(
      'https://image.tmdb.org/t/p/w342/a.jpg'
    )
    expect(sizedCover('https://covers.openlibrary.org/b/id/1-L.jpg', 'thumb')).toBe(
      'https://covers.openlibrary.org/b/id/1-M.jpg'
    )
    expect(sizedCover('https://covers.openlibrary.org/b/id/1-L.jpg', 'poster')).toBe(
      'https://covers.openlibrary.org/b/id/1-L.jpg'
    )
    expect(sizedCover('https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg', 'thumb')).toBe(
      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx1.jpg'
    )
    expect(sizedCover('https://ejemplo.com/x.jpg', 'thumb')).toBe('https://ejemplo.com/x.jpg')
    expect(sizedCover(null, 'thumb')).toBeNull()
  })
})
