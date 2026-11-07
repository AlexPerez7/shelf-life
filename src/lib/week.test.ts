import { describe, expect, it } from 'vitest'
import { barHeights, dayKey, weekDays } from './week'

// Sábado 7 de noviembre de 2026, mediodía local.
const NOW = new Date(2026, 10, 7, 12, 0, 0)
const at = (day: number, hour = 10) => ({ occurred_at: new Date(2026, 10, day, hour).toISOString() })

describe('weekDays', () => {
  it('devuelve 7 días que terminan hoy, el más viejo primero', () => {
    const days = weekDays([], NOW)
    expect(days).toHaveLength(7)
    expect(days[0].key).toBe(dayKey(new Date(2026, 10, 1)))
    expect(days[6].key).toBe(dayKey(NOW))
    expect(days.map((d) => d.isToday)).toEqual([false, false, false, false, false, false, true])
  })

  it('cuenta la actividad de cada día en hora local', () => {
    const days = weekDays([at(7), at(7, 23), at(5), at(1)], NOW)
    expect(days.map((d) => d.count)).toEqual([1, 0, 0, 0, 1, 0, 2])
  })

  it('ignora lo que quedó fuera de la semana', () => {
    const october31 = { occurred_at: new Date(2026, 9, 31, 10).toISOString() }
    expect(weekDays([october31, at(6)], NOW).reduce((s, d) => s + d.count, 0)).toBe(1)
  })

  it('cruza el cambio de mes', () => {
    const days = weekDays([], new Date(2026, 10, 3))
    expect(days[0].key).toBe(dayKey(new Date(2026, 9, 28)))
  })

  it('rotula con la inicial del día', () => {
    const labels = weekDays([], NOW).map((d) => d.label)
    expect(labels[6]).toBe('S') // sábado
    expect(labels[0]).toBe('D') // domingo 1
  })
})

describe('barHeights', () => {
  it('escala respecto del día más activo', () => {
    const days = weekDays([at(7), at(7), at(7), at(7), at(5), at(5)], NOW)
    expect(barHeights(days)).toEqual([0, 0, 0, 0, 0.5, 0, 1])
  })

  it('sin actividad, todas en 0', () => {
    expect(barHeights(weekDays([], NOW))).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})
