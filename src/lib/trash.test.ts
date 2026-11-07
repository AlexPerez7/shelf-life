import { describe, expect, it } from 'vitest'
import { isMissingTrashColumn, TRASH_DAYS, trashCutoff, trashDaysLabel, trashDaysLeft } from './trash'

// Fechas locales (no UTC): los días de calendario no dependen de la zona del equipo.
const at = (month: number, day: number, hour = 12) => new Date(2026, month - 1, day, hour)
const NOW = at(11, 10)
const iso = (d: Date) => d.toISOString()

describe('papelera', () => {
  it('queda 30 días', () => {
    expect(TRASH_DAYS).toBe(30)
    expect(trashDaysLeft(iso(at(11, 10)), NOW)).toBe(30)
    expect(trashDaysLeft(iso(at(11, 1)), NOW)).toBe(21)
  })

  it('cuenta días de calendario, sin importar la hora', () => {
    // Borrado el 11/10 a las 18:00 → vence el 10/11 a las 18:00: hoy.
    expect(trashDaysLeft(iso(at(10, 11, 18)), NOW)).toBe(0)
    // Borrado el 12/10 → vence el 11/11: mañana.
    expect(trashDaysLeft(iso(at(10, 12, 23)), NOW)).toBe(1)
  })

  it('al vencer no baja de cero', () => {
    expect(trashDaysLeft(iso(at(10, 1)), NOW)).toBe(0)
    expect(trashDaysLeft('2025-01-01T00:00:00Z', NOW)).toBe(0)
  })

  it('el corte de lo vencido es hace 30 días', () => {
    expect(trashCutoff(NOW)).toBe(iso(new Date(NOW.getTime() - 30 * 86_400_000)))
  })

  it('lo describe en español', () => {
    expect(trashDaysLabel(iso(at(11, 10)), NOW)).toBe('Se elimina en 30 días')
    expect(trashDaysLabel(iso(at(10, 12)), NOW)).toBe('Se elimina mañana')
    expect(trashDaysLabel(iso(at(10, 11, 18)), NOW)).toBe('Se elimina hoy')
    expect(trashDaysLabel(iso(at(9, 1)), NOW)).toBe('Se elimina hoy')
  })

  it('reconoce el error de la columna que falta, y no otros', () => {
    expect(isMissingTrashColumn({ code: '42703', message: 'column items.deleted_at does not exist' })).toBe(true)
    expect(isMissingTrashColumn({ message: 'Could not find the deleted_at column' })).toBe(true)
    expect(isMissingTrashColumn({ code: '08006', message: 'Failed to fetch' })).toBe(false)
    expect(isMissingTrashColumn(null)).toBe(false)
  })
})
