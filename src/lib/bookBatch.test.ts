import { describe, expect, it } from 'vitest'
import {
  allSelected,
  batchFormatChanges,
  batchStatusChanges,
  selectedBooks,
  toggleSelected,
} from './bookBatch'
import { makeItem } from '../test/factories'

const TODAY = '2026-10-09'

describe('selección', () => {
  it('agrega y saca ids sin tocar el conjunto original', () => {
    const empty = new Set<string>()
    const one = toggleSelected(empty, 'a')
    expect([...one]).toEqual(['a'])
    expect(empty.size).toBe(0)
    expect(toggleSelected(one, 'a').size).toBe(0)
  })

  it('detecta cuando todo lo visible está seleccionado', () => {
    const [a, b] = [makeItem(), makeItem()]
    expect(allSelected([a, b], new Set([a.id]))).toBe(false)
    expect(allSelected([a, b], new Set([a.id, b.id]))).toBe(true)
    expect(allSelected([], new Set())).toBe(false)
  })

  it('descarta los ids que ya no existen', () => {
    const [a, b] = [makeItem(), makeItem()]
    expect(selectedBooks([a, b], new Set([b.id, 'borrado']))).toEqual([b])
  })
})

describe('cambio de estado en lote', () => {
  it('aplica las reglas de la ficha: fechas y páginas al terminar', () => {
    const book = makeItem({ status: 'in_progress', progress: 40, progress_total: 200 })
    expect(batchStatusChanges(book, 'completed', TODAY)).toEqual({
      status: 'completed',
      date_finished: TODAY,
      progress: 200,
    })
  })

  it('saltea los que ya tienen ese estado', () => {
    expect(batchStatusChanges(makeItem({ status: 'completed' }), 'completed', TODAY)).toBeNull()
  })
})

describe('cambio de formato en lote', () => {
  it('junta varios formatos con coma', () => {
    expect(batchFormatChanges(makeItem(), ['Físico', 'Kindle'])).toEqual({ format: 'Físico, Kindle' })
  })

  it('sin formatos lo vacía, y saltea los que ya están igual', () => {
    expect(batchFormatChanges(makeItem({ format: 'Kindle' }), [])).toEqual({ format: null })
    expect(batchFormatChanges(makeItem({ format: null }), [])).toBeNull()
    expect(batchFormatChanges(makeItem({ format: 'Kindle' }), ['Kindle'])).toBeNull()
  })
})
