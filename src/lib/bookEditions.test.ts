import { describe, expect, it } from 'vitest'
import { editionChanges, editionFormat, editionLabel, editionLanguages, type BookEdition } from './bookEditions'
import { makeItem } from '../test/factories'

const edition = (overrides: Partial<BookEdition> = {}): BookEdition => ({
  id: 'OL1M',
  title: 'Cien años de soledad',
  publisher: 'Debolsillo',
  publish_date: 'Mar 2009',
  year: 2009,
  pages: 471,
  isbn: '9788497592208',
  languages: ['spa'],
  cover_url: 'https://covers.openlibrary.org/b/id/1-L.jpg',
  format: 'Paperback',
  ...overrides,
})

describe('elegir la edición', () => {
  it('copia páginas, ISBN y editorial, y deja lo demás de los datos como estaba', () => {
    const item = makeItem({
      status: 'planned',
      progress_total: 400,
      metadata: { authors: ['García Márquez'], isbn: 'viejo', publisher: 'Otra' },
    })
    expect(editionChanges(item, edition(), false)).toEqual({
      metadata: { authors: ['García Márquez'], isbn: '9788497592208', publisher: 'Debolsillo' },
      progress_total: 471,
    })
  })

  it('la portada solo cambia si se pide y la edición tiene', () => {
    const item = makeItem({ cover_url: 'https://x/mia.jpg' })
    expect(editionChanges(item, edition(), true).cover_url).toBe('https://covers.openlibrary.org/b/id/1-L.jpg')
    expect(editionChanges(item, edition(), false).cover_url).toBeUndefined()
    expect(editionChanges(item, edition({ cover_url: null }), true).cover_url).toBeUndefined()
  })

  it('lo que la edición no trae no pisa lo que ya había', () => {
    const item = makeItem({ progress_total: 300, metadata: { isbn: '123', publisher: 'Mía' } })
    const changes = editionChanges(item, edition({ isbn: null, publisher: null, pages: null }), false)
    expect(changes).toEqual({ metadata: { isbn: '123', publisher: 'Mía' } })
  })

  it('un libro leído sigue con todas las páginas y uno en curso no pasa del total', () => {
    const done = makeItem({ status: 'completed', progress: 300, progress_total: 300 })
    expect(editionChanges(done, edition({ pages: 471 }), false).progress).toBe(471)

    const reading = makeItem({ status: 'in_progress', progress: 350, progress_total: 500 })
    expect(editionChanges(reading, edition({ pages: 300 }), false).progress).toBe(300)
    expect(editionChanges(reading, edition({ pages: 600 }), false).progress).toBeUndefined()
  })

  it('describe la edición en español', () => {
    expect(editionLanguages(edition({ languages: ['spa', 'xyz'] }))).toBe('Español, XYZ')
    expect(editionFormat(edition())).toBe('Tapa blanda')
    expect(editionFormat(edition({ format: 'Leather Bound' }))).toBe('Leather Bound')
    expect(editionFormat(edition({ format: null }))).toBeNull()
    expect(editionLabel(edition())).toBe('Debolsillo · 2009')
    expect(editionLabel(edition({ year: null, publish_date: 'c1990' }))).toBe('Debolsillo · c1990')
    expect(editionLabel(edition({ publisher: null, year: null, publish_date: null }))).toBe('')
  })
})
