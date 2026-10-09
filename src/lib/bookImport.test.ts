import { describe, expect, it } from 'vitest'
import { existingBookKeys, importedToItem, isDuplicate, parseBookExport, parseCsv } from './bookImport'
import { makeItem } from '../test/factories'

const GOODREADS = `Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies
2767052,"The Hunger Games (The Hunger Games, #1)",Suzanne Collins,"Collins, Suzanne",,"=""0439023483""","=""9780439023481""",4,4.33,Scholastic Press,Hardcover,374,2008,2008,2023/05/14,2023/01/02,,,read,"Muy bueno.<br/>Segunda línea, con ""comillas""",,Nota privada,2,0
1,Rayuela,Julio Cortázar,"Cortázar, Julio",,"=""""","=""""",0,4.1,Alfaguara,Kindle Edition,600,1963,1963,,2024/02/10,to-read,to-read (#3),to-read,,,,0,0
2,Dune,Frank Herbert,"Herbert, Frank",,"=""""","=""""",0,4.2,Ace,Audible Audio,,1965,1965,,2024/03/01,,,currently-reading,,,,1,0
`

const STORYGRAPH = `Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Dates Read,Read Count,Moods,Pace,Character- or Plot-Driven?,Strong Character Development?,Loveable Characters?,Diverse Characters?,Flawed Characters?,Star Rating,Review,Content Warnings,Content Warning Description,Tags,Owned?
Piranesi,Susanna Clarke,,9781635575637,digital,read,2022/03/01,2022/03/20,2022/03/05-2022/03/20,1,mysterious,medium,,,,,,4.25,"Línea uno
línea dos",,,,No
Dune,"Frank Herbert",,,paperback,did-not-finish,2021/01/01,,,0,,,,,,,,,,,,,No
`

describe('parseCsv', () => {
  it('respeta comillas, comillas dobles, comas y saltos de línea dentro de un campo', () => {
    expect(parseCsv('a,b\n"x, y","di ""hola""\notra línea"\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'di "hola"\notra línea'],
    ])
  })

  it('ignora el BOM y las filas vacías', () => {
    expect(parseCsv('﻿a\n\n1\n')).toEqual([['a'], ['1']])
  })
})

describe('parseBookExport: Goodreads', () => {
  const { source, books } = parseBookExport(GOODREADS)

  it('reconoce el archivo y lee todos los libros', () => {
    expect(source).toBe('goodreads')
    expect(books.map((b) => b.title)).toEqual([
      'The Hunger Games (The Hunger Games, #1)',
      'Rayuela',
      'Dune',
    ])
  })

  it('traduce estado, puntaje, ISBN, fechas y formato', () => {
    const [hunger, rayuela, dune] = books
    expect(hunger).toMatchObject({
      status: 'completed',
      rating: 8,
      isbn: '9780439023481',
      pages: 374,
      dateRead: '2023-05-14',
      dateAdded: '2023-01-02',
      format: 'Físico',
      rereads: 1,
      notes: 'Nota privada',
      review: 'Muy bueno.\nSegunda línea, con "comillas"',
    })
    expect(rayuela).toMatchObject({ status: 'wishlist', rating: null, isbn: null, format: 'Kindle' })
    expect(dune).toMatchObject({ status: 'in_progress', format: 'Audiolibro' })
  })
})

describe('parseBookExport: StoryGraph', () => {
  const { source, books } = parseBookExport(STORYGRAPH)

  it('reconoce el archivo y traduce sus campos', () => {
    expect(source).toBe('storygraph')
    expect(books[0]).toMatchObject({
      title: 'Piranesi',
      status: 'completed',
      rating: 9, // 4.25 estrellas -> 8.5 -> 9
      isbn: '9781635575637',
      format: 'eBook',
      dateRead: '2022-03-20',
      review: 'Línea uno\nlínea dos',
    })
    expect(books[1]).toMatchObject({ title: 'Dune', status: 'dropped', format: 'Físico' })
  })
})

describe('parseBookExport: otros archivos', () => {
  it('rechaza un CSV que no es de Goodreads ni StoryGraph', () => {
    expect(() => parseBookExport('a,b\n1,2')).toThrow(/Goodreads o StoryGraph/)
  })

  it('rechaza un archivo vacío', () => {
    expect(() => parseBookExport('')).toThrow()
  })
})

describe('duplicados', () => {
  it('reconoce por ISBN o por título + autor, sin importar tildes ni mayúsculas', () => {
    const keys = existingBookKeys([
      makeItem({ title: 'RAYUELA', metadata: { authors: ['Julio Cortazar'] } }),
      makeItem({ title: 'Otro título', metadata: { isbn: '9781635575637' } }),
    ])
    const { books } = parseBookExport(GOODREADS)
    const piranesi = parseBookExport(STORYGRAPH).books[0]
    expect(isDuplicate(books[1], keys)).toBe(true) // Rayuela
    expect(isDuplicate(piranesi, keys)).toBe(true) // mismo ISBN
    expect(isDuplicate(books[0], keys)).toBe(false)
  })
})

describe('importedToItem', () => {
  it('arma la fila: leído con avance completo, portada por ISBN y fecha de alta', () => {
    const [hunger, rayuela] = parseBookExport(GOODREADS).books
    expect(importedToItem(hunger)).toMatchObject({
      media_type: 'book',
      status: 'completed',
      progress: 374,
      progress_total: 374,
      date_finished: '2023-05-14',
      release_date: '2008-01-01',
      replays: 1,
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780439023481-L.jpg?default=false',
      created_at: '2023-01-02T12:00:00',
      metadata: { authors: ['Suzanne Collins'], isbn: '9780439023481', publisher: 'Scholastic Press' },
    })
    // Por leer: sin avance ni fecha de fin.
    expect(importedToItem(rayuela)).toMatchObject({ progress: 0, date_finished: null, cover_url: null })
  })
})
