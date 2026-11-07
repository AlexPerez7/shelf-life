import { describe, expect, it } from 'vitest'
import { bookSummary, gameSummary } from './librarySummary'
import { makeGame, makeItem } from '../test/factories'

const labels = (parts: { value: string; label: string }[]) => parts.map((p) => `${p.value} ${p.label}`)

describe('bookSummary', () => {
  it('vacío: solo los libros', () => {
    expect(labels(bookSummary([]))).toEqual(['0 libros'])
  })

  it('cuenta leyendo, leídos y páginas (el total de los leídos, el avance del resto)', () => {
    const books = [
      makeItem({ media_type: 'book', status: 'completed', progress: 300, progress_total: 320 }),
      makeItem({ media_type: 'book', status: 'in_progress', progress: 80, progress_total: 400 }),
      makeItem({ media_type: 'book', status: 'wishlist' }),
    ]
    expect(labels(bookSummary(books))).toEqual(['3 libros', '1 leyendo', '1 leído', '400 páginas'])
  })
})

describe('gameSummary', () => {
  it('un juego sin nada más: solo el título', () => {
    expect(labels(gameSummary([makeGame({ status: 'deseado', hours_played: 0 })]))).toEqual(['1 juego'])
  })

  it('cuenta jugando, completados y horas redondeadas', () => {
    const games = [
      makeGame({ status: 'jugando', hours_played: 10.4 }),
      makeGame({ status: 'completado', hours_played: 1200.2 }),
      makeGame({ status: 'completado', hours_played: 0 }),
    ]
    expect(labels(gameSummary(games))).toEqual(['3 juegos', '1 jugando', '2 completados', '1211h jugadas'])
  })
})
