import { describe, expect, it } from 'vitest'
import {
  bookGenres,
  defaultDir,
  filterBooks,
  isViewActive,
  parseBookView,
  readYears,
  sortBooks,
  type BookView,
} from './bookView'
import { makeItem } from '../test/factories'

const noView: BookView = { sort: null, dir: null, year: null, genre: null, favorites: false }
const titles = (items: { title: string }[]) => items.map((i) => i.title)

describe('vista del librero en la URL', () => {
  it('lee orden, dirección y filtros, e ignora valores inválidos', () => {
    const view = parseBookView(new URLSearchParams('orden=autor&dir=desc&anio=2025&genero=Novela&fav=1'))
    expect(view).toEqual({ sort: 'autor', dir: 'desc', year: 2025, genre: 'Novela', favorites: true })
    expect(parseBookView(new URLSearchParams('orden=zzz&dir=x&anio=abc'))).toEqual(noView)
  })

  it('sin nada elegido se ve el librero; con algo, la lista plana', () => {
    expect(isViewActive(noView)).toBe(false)
    expect(isViewActive({ ...noView, sort: 'titulo' })).toBe(true)
    expect(isViewActive({ ...noView, favorites: true })).toBe(true)
  })
})

describe('filtrar', () => {
  const books = [
    makeItem({ title: 'A', status: 'completed', date_finished: '2025-05-01', genres: ['Novela'], is_favorite: true }),
    makeItem({ title: 'B', status: 'completed', date_finished: '2024-02-01', genres: ['Ensayo'] }),
    makeItem({
      title: 'C',
      status: 'completed',
      date_finished: '2025-08-01',
      genres: ['Novela'],
      metadata: { readings: [{ started: null, finished: '2023-01-10' }] },
    }),
  ]

  it('por año leído (cuenta también las relecturas)', () => {
    expect(titles(filterBooks(books, { ...noView, year: 2025 }))).toEqual(['A', 'C'])
    expect(titles(filterBooks(books, { ...noView, year: 2023 }))).toEqual(['C'])
  })

  it('por género y favoritos, combinados', () => {
    expect(titles(filterBooks(books, { ...noView, genre: 'Novela' }))).toEqual(['A', 'C'])
    expect(titles(filterBooks(books, { ...noView, genre: 'Novela', favorites: true }))).toEqual(['A'])
  })

  it('lista los años y géneros disponibles', () => {
    expect(readYears(books)).toEqual([2025, 2024, 2023])
    expect(bookGenres(books)).toEqual(['Novela', 'Ensayo'])
  })
})

describe('ordenar', () => {
  it('por título y autor, de la A a la Z, sin distinguir tildes ni mayúsculas', () => {
    const books = [
      makeItem({ title: 'Zeta', metadata: { authors: ['Álvarez'] } }),
      makeItem({ title: 'alfa', metadata: { authors: ['Borges'] } }),
      makeItem({ title: 'Beta', metadata: { authors: ['alvarado'] } }),
    ]
    expect(titles(sortBooks(books, 'titulo'))).toEqual(['alfa', 'Beta', 'Zeta'])
    expect(titles(sortBooks(books, 'autor'))).toEqual(['Beta', 'Zeta', 'alfa'])
    expect(titles(sortBooks(books, 'titulo', 'desc'))).toEqual(['Zeta', 'Beta', 'alfa'])
  })

  it('por puntaje y páginas: de mayor a menor, y los que no tienen dato siempre al final', () => {
    const books = [
      makeItem({ title: 'Sin', rating: null, progress_total: null }),
      makeItem({ title: 'Bajo', rating: 4, progress_total: 100 }),
      makeItem({ title: 'Alto', rating: 9, progress_total: 500 }),
    ]
    expect(titles(sortBooks(books, 'puntaje'))).toEqual(['Alto', 'Bajo', 'Sin'])
    expect(titles(sortBooks(books, 'puntaje', 'asc'))).toEqual(['Bajo', 'Alto', 'Sin'])
    expect(titles(sortBooks(books, 'paginas'))).toEqual(['Alto', 'Bajo', 'Sin'])
  })

  it('por fecha de término usa la última lectura, y por publicación el año', () => {
    const books = [
      makeItem({ title: 'Viejo', status: 'completed', date_finished: '2022-01-01', release_date: '1999-05-05' }),
      makeItem({
        title: 'Releído',
        status: 'completed',
        date_finished: '2025-03-03',
        release_date: '2010-01-01',
      }),
      makeItem({ title: 'Pendiente', release_date: '2024-01-01' }),
    ]
    expect(titles(sortBooks(books, 'terminado'))).toEqual(['Releído', 'Viejo', 'Pendiente'])
    expect(titles(sortBooks(books, 'publicado'))).toEqual(['Pendiente', 'Releído', 'Viejo'])
  })

  it('por agregado, el más nuevo primero, y no modifica la lista original', () => {
    const books = [
      makeItem({ title: 'Primero', created_at: '2026-01-01T00:00:00Z' }),
      makeItem({ title: 'Último', created_at: '2026-06-01T00:00:00Z' }),
    ]
    expect(titles(sortBooks(books, 'agregado'))).toEqual(['Último', 'Primero'])
    expect(titles(books)).toEqual(['Primero', 'Último'])
    expect(defaultDir('agregado')).toBe('desc')
    expect(defaultDir('autor')).toBe('asc')
  })
})
