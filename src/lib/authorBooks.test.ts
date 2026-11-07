import { describe, expect, it } from 'vitest'
import { authorSuggestions, libraryMatch, mainAuthor, ownBooksByAuthor } from './authorBooks'
import { makeItem } from '../test/factories'
import type { MediaSearchResult } from '../types/item'

const book = (title: string, authors: string[], overrides = {}) =>
  makeItem({ media_type: 'book', title, metadata: { authors }, ...overrides })

const result = (title: string, external_id: string): MediaSearchResult => ({
  source: 'openlibrary',
  external_id,
  media_type: 'book',
  title,
  original_title: null,
  cover_url: null,
  release_date: null,
  genres: [],
  summary: null,
  episodes: null,
  runtime_minutes: null,
})

describe('más de este autor', () => {
  it('el autor principal es el primero con nombre', () => {
    expect(mainAuthor(book('X', ['  ', ' Ursula K. Le Guin ', 'Otro']))).toBe('Ursula K. Le Guin')
    expect(mainAuthor(book('X', []))).toBeNull()
  })

  it('los otros libros del autor, sin el actual ni tildes ni mayúsculas, por fecha de publicación', () => {
    const current = book('Rayuela', ['Julio Cortázar'])
    const a = book('Bestiario', ['julio cortazar'], { release_date: '1951-01-01' })
    const b = book('Final del juego', ['Julio Cortázar', 'Otro'], { release_date: '1956-01-01' })
    const other = book('Ficciones', ['Borges'])
    const own = ownBooksByAuthor([b, current, other, a], current, 'Julio Cortázar')
    expect(own.map((i) => i.title)).toEqual(['Bestiario', 'Final del juego'])
  })

  it('reconoce un libro del librero por id o por título sin subtítulo', () => {
    const owned = book('Dune', ['Frank Herbert'], { source: 'openlibrary', external_id: 'OL1W' })
    expect(libraryMatch([owned], result('Otro título', 'OL1W'))).toBe(owned)
    expect(libraryMatch([owned], result('Dune: edición especial', 'OL9W'))).toBe(owned)
    expect(libraryMatch([owned], result('Dune Messiah', 'OL2W'))).toBeNull()
  })

  it('las sugerencias saltan lo que ya tienes y el libro de la ficha, y se limitan', () => {
    const current = book('Dune', ['Frank Herbert'])
    const owned = book('Dune Messiah', ['Frank Herbert'])
    const many = Array.from({ length: 12 }, (_, i) => result(`Libro ${i}`, `OL${i + 10}W`))
    const suggestions = authorSuggestions(
      [owned],
      current,
      [result('Dune', 'OL1W'), result('Dune Messiah', 'OL2W'), ...many]
    )
    expect(suggestions).toHaveLength(8)
    expect(suggestions[0].title).toBe('Libro 0')
  })
})
