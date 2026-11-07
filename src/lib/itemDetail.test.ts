import { describe, expect, it } from 'vitest'
import { hasDetail, keepDetail, withDetail } from './itemDetail'
import { makeItem } from '../test/factories'
import type { Item } from '../types/item'

/** Como llega de la lista: sin las columnas de texto largo. */
function listRow(item: Item): Item {
  const row: Partial<Item> = { ...item }
  delete row.summary
  delete row.review
  delete row.notes
  return row as Item
}

describe('hasDetail', () => {
  it('distingue la fila de la lista de la completa, aunque el texto sea null', () => {
    const full = makeItem({ summary: null, review: null, notes: null })
    expect(hasDetail(full)).toBe(true)
    expect(hasDetail(listRow(full))).toBe(false)
  })
})

describe('keepDetail', () => {
  const opened = makeItem({ id: 'a', summary: 'Sinopsis', review: 'Muy bueno', notes: null })
  const other = makeItem({ id: 'b' })

  it('conserva el detalle ya cargado al volver a traer la lista', () => {
    const [a, b] = keepDetail([listRow(opened), listRow(other)], [opened, other])
    expect(a).toMatchObject({ summary: 'Sinopsis', review: 'Muy bueno', notes: null })
    expect(hasDetail(b)).toBe(true)
  })

  it('lo nuevo de la lista pisa el resto de los campos', () => {
    const [a] = keepDetail([{ ...listRow(opened), progress: 9 }], [opened])
    expect(a.progress).toBe(9)
    expect(a.summary).toBe('Sinopsis')
  })

  it('lo que nunca se abrió sigue sin detalle', () => {
    const [a] = keepDetail([listRow(other)], [listRow(other)])
    expect(hasDetail(a)).toBe(false)
  })

  it('sin lista anterior devuelve lo traído tal cual', () => {
    const fetched = [listRow(opened)]
    expect(keepDetail(fetched, [])).toBe(fetched)
  })
})

describe('withDetail', () => {
  const row = listRow(makeItem({ id: 'a' }))
  const detail = { summary: 'Sinopsis', review: 'Reseña', notes: 'Notas' }

  it('completa el ítem con el detalle', () => {
    expect(withDetail(row, detail)).toMatchObject(detail)
  })

  it('lo editado sin conexión gana sobre lo que trae la base', () => {
    expect(withDetail(row, detail, { notes: 'Nota nueva', rating: 5 })).toMatchObject({
      summary: 'Sinopsis',
      notes: 'Nota nueva',
    })
  })
})
