// Helpers de fechas en hora LOCAL.
//
// `new Date('2026-09-28')` interpreta un string solo-fecha como medianoche UTC,
// así que en zonas con offset negativo (Chile, Argentina, México...) se muestra
// como el día anterior. Igual con `toISOString().slice(0, 10)`: después de las
// 21:00 en UTC-3 devuelve la fecha de mañana. Todo lo que maneje fechas
// "YYYY-MM-DD" (inputs type="date", date_started, date_finished) debe pasar por
// acá.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Fecha de hoy como "YYYY-MM-DD" en hora local. */
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Convierte un string de fecha a Date. Si es solo-fecha ("YYYY-MM-DD") lo
 * interpreta como medianoche LOCAL; cualquier otro formato (timestamps ISO
 * con hora/zona) se delega a `new Date`.
 */
export function parseDate(value: string): Date {
  const m = DATE_ONLY.exec(value)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(value)
}

/** Fecha legible en el idioma del dispositivo. */
export function formatDate(value: string): string {
  return parseDate(value).toLocaleDateString()
}

/**
 * Timestamp ISO para una sesión jugada en `day` ("YYYY-MM-DD"). Si es hoy usa
 * la hora actual; si es otro día, el mediodía local (lejos de la medianoche
 * para que ningún cambio de zona la mueva de día).
 */
export function sessionTimestamp(day: string): string {
  if (day === todayISO()) return new Date().toISOString()
  const d = parseDate(day)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

/** Año (texto) <-> segundos unix al 1 de enero UTC, como guarda IGDB. */
export function yearToUnix(year: string): number | undefined {
  return /^\d{4}$/.test(year.trim()) ? Date.UTC(Number(year.trim()), 0, 1) / 1000 : undefined
}

export function unixToYear(seconds: number | null | undefined): string {
  return seconds != null ? String(new Date(seconds * 1000).getUTCFullYear()) : ''
}
