// Qué versión de la app está corriendo (la fija vite.config.ts al compilar).

declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string

/** Los 7 primeros caracteres del commit que se desplegó, o 'dev' en desarrollo. */
export const appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'

/** Cuándo se compiló, 'YYYY-MM-DDTHH:mm:ssZ'. */
export const buildDate = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : ''

/** "7 nov 2026", o nada si no hay fecha. */
export function buildDateLabel(date = buildDate): string {
  if (!date) return ''
  const d = new Date(date)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')
}
