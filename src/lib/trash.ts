// Papelera de Libros: un libro borrado queda 30 días y después se elimina.

/** Días que un libro se queda en la papelera. */
export const TRASH_DAYS = 30

const DAY_MS = 86_400_000

/** Fecha desde la cual lo que está en la papelera ya venció (hace 30 días), en ISO. */
export function trashCutoff(now = new Date()): string {
  return new Date(now.getTime() - TRASH_DAYS * DAY_MS).toISOString()
}

/** Medianoche local del día de `date`. */
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/**
 * Días de calendario que le quedan: 0 si vence hoy (a cualquier hora), 1 si
 * vence mañana. Nunca baja de 0.
 */
export function trashDaysLeft(deletedAt: string, now = new Date()): number {
  const expires = new Date(new Date(deletedAt).getTime() + TRASH_DAYS * DAY_MS)
  const days = Math.round((startOfDay(expires).getTime() - startOfDay(now).getTime()) / DAY_MS)
  return Math.max(0, days)
}

/** "Se elimina mañana", "Se elimina en 12 días". */
export function trashDaysLabel(deletedAt: string, now = new Date()): string {
  const days = trashDaysLeft(deletedAt, now)
  if (days === 0) return 'Se elimina hoy'
  if (days === 1) return 'Se elimina mañana'
  return `Se elimina en ${days} días`
}

/**
 * ¿El error es que falta la columna `deleted_at` (migración 0015 sin
 * aplicar)? Entonces se sigue como antes, sin papelera.
 */
export function isMissingTrashColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === '42703' || /deleted_at/i.test(error.message ?? '')
}
