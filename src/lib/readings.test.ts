import { describe, expect, it } from 'vitest'
import {
  addReadingChanges,
  editReadingChanges,
  finishedDates,
  finishedInYear,
  lastFinishIn,
  pastReadings,
  readingDays,
  removeReadingChanges,
  rereadChanges,
  timesRead,
} from './readings'
import { makeItem } from '../test/factories'

const book = (overrides = {}) =>
  makeItem({
    media_type: 'book',
    status: 'completed',
    date_started: '2024-03-01',
    date_finished: '2024-03-20',
    progress: 300,
    progress_total: 300,
    ...overrides,
  })

describe('releer', () => {
  it('pasa la lectura terminada al historial y empieza una nueva desde la página 0', () => {
    const b = book({ metadata: { authors: ['X'] } })
    const changes = rereadChanges(b, '2026-01-05')
    expect(changes).toMatchObject({
      status: 'in_progress',
      progress: 0,
      replays: 1,
      date_started: '2026-01-05',
      date_finished: null,
    })
    expect(changes.metadata).toEqual({ authors: ['X'], readings: [{ started: '2024-03-01', finished: '2024-03-20' }] })
  })

  it('mientras se relee, la lectura anterior sigue contando en su año', () => {
    const rereading = { ...book(), ...rereadChanges(book(), '2026-01-05') } as ReturnType<typeof book>
    expect(finishedDates(rereading)).toEqual(['2024-03-20'])
    expect(finishedInYear(rereading, 2024)).toBe(true)
    expect(finishedInYear(rereading, 2026)).toBe(false)
    expect(timesRead(rereading)).toBe(1)
  })
})

describe('veces leído', () => {
  it('cuenta las lecturas con fecha y la actual si está terminado', () => {
    const b = book({ replays: 2, metadata: { readings: [{ started: null, finished: '2019-05-01' }, { started: '2021-01-01', finished: '2021-02-01' }] } })
    expect(timesRead(b)).toBe(3)
    expect(lastFinishIn(b, 2021)).toBe('2021-02-01')
  })

  it('respeta las relecturas importadas sin fechas', () => {
    expect(timesRead(book({ replays: 2 }))).toBe(3)
    expect(timesRead(book({ status: 'in_progress', date_finished: null, replays: 1 }))).toBe(1)
  })
})

describe('editar el historial', () => {
  const b = book({ replays: 1, metadata: { readings: [{ started: '2020-01-01', finished: '2020-01-10' }] } })

  it('agrega una lectura anterior en orden y suma una relectura', () => {
    const changes = addReadingChanges(b, { started: '2018-06-01', finished: '2018-06-15' })
    expect(changes.replays).toBe(2)
    expect(pastReadings({ metadata: changes.metadata! }).map((r) => r.started)).toEqual(['2018-06-01', '2020-01-01'])
  })

  it('cambia las fechas de una y borra otra', () => {
    expect(editReadingChanges(b, 0, { started: '2020-01-02', finished: '2020-01-12' }).metadata?.readings).toEqual([
      { started: '2020-01-02', finished: '2020-01-12' },
    ])
    expect(removeReadingChanges(b, 0)).toMatchObject({ replays: 0, metadata: { readings: [] } })
  })
})

describe('readingDays', () => {
  it('cuenta los días de una lectura, con los dos extremos', () => {
    expect(readingDays({ started: '2024-03-01', finished: '2024-03-20' })).toBe(20)
    expect(readingDays({ started: '2024-03-01', finished: null })).toBeNull()
    expect(readingDays({ started: '2024-03-20', finished: '2024-03-01' })).toBeNull()
  })
})
