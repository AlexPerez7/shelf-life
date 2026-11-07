// Los últimos 7 días del inicio: cuánta actividad hubo cada día (episodios,
// páginas, sesiones y películas anotadas), para el gráfico de "Esta semana".

import { parseDate } from './dates'

export interface WeekDay {
  /** Día local, "YYYY-M-D". */
  key: string
  /** Inicial del día de la semana ("L", "M", "X"...). */
  label: string
  /** Registros de actividad de ese día. */
  count: number
  isToday: boolean
}

/** Día local de una fecha, como clave estable. */
export function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

/** Los 7 días que terminan hoy (el más viejo primero), con la actividad de cada uno. */
export function weekDays(rows: { occurred_at: string }[], now: Date = new Date()): WeekDay[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const key = dayKey(parseDate(r.occurred_at))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i))
    const key = dayKey(date)
    return {
      key,
      label: date.toLocaleDateString('es', { weekday: 'narrow' }).toUpperCase(),
      count: counts.get(key) ?? 0,
      isToday: i === 6,
    }
  })
}

/** Alto de cada barra (0 a 1) respecto del día con más actividad; los días sin nada quedan en 0. */
export function barHeights(days: WeekDay[]): number[] {
  const max = Math.max(0, ...days.map((d) => d.count))
  return days.map((d) => (max === 0 ? 0 : d.count / max))
}
