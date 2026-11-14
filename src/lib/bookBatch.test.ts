import { describe, expect, it } from 'vitest'
import { batchFormatChanges, batchStatusChanges, toggleSelected } from './bookBatch'
import { makeItem } from '../test/factories'

describe('selección', () => {
  it('agrega y saca ids sin mutar la selección original', () => {
    const base = new Set(['a'])
    const withB = toggleSelected(base, 'b')
    expect([...withB]).toEqual(['a', 'b'])
    expect([...base]).toEqual(['a'])
    expect([...toggleSelected(withB, 'a')]).toEqual(['b'])
  })
})

describe('cambiar el estado en lote', () => {
  const today = '2026-11-14'

  it('aplica las reglas de la ficha a cada libro', () => {
    const a = makeItem({ status: 'wishlist', progress_total: 300, progress: 0 })
    const b = makeItem({ status: 'in_progress', date_started: '2026-10-01', progress_total: 200, progress: 50 })
    const result = batchStatusChanges([a, b], 'completed', today)
    expect(result).toEqual([
      { id: a.id, changes: { status: 'completed', date_finished: today, progress: 300 } },
      { id: b.id, changes: { status: 'completed', date_finished: today, progress: 200 } },
    ])
  })

  it('no pisa fechas que ya existen y salta los que ya están en ese estado', () => {
    const done = makeItem({ status: 'completed' })
    const reading = makeItem({ status: 'in_progress' })
    const started = makeItem({ status: 'planned', date_started: '2026-01-05' })
    const result = batchStatusChanges([done, reading, started], 'in_progress', today)
    expect(result).toEqual([
      { id: done.id, changes: { status: 'in_progress', date_started: today } },
      { id: started.id, changes: { status: 'in_progress' } },
    ])
    expect(batchStatusChanges([done], 'completed', today)).toEqual([])
  })
})

describe('cambiar el formato en lote', () => {
  it('deja el formato elegido y salta los que ya lo tienen', () => {
    const a = makeItem({ format: null })
    const b = makeItem({ format: 'Kindle' })
    const c = makeItem({ format: 'Físico, eBook' })
    expect(batchFormatChanges([a, b, c], 'Kindle')).toEqual([
      { id: a.id, changes: { format: 'Kindle' } },
      { id: c.id, changes: { format: 'Kindle' } },
    ])
  })

  it('sin formatos, lo borra', () => {
    const a = makeItem({ format: 'Kobo' })
    const b = makeItem({ format: null })
    expect(batchFormatChanges([a, b], '')).toEqual([{ id: a.id, changes: { format: null } }])
  })
})
