// La app puede vivir en una subcarpeta (GitHub Pages: /PlayDex/). Vite expone
// esa base en BASE_URL ('/' en desarrollo); todo lo que arme URLs absolutas o
// apunte a archivos de public/ tiene que pasar por acá.

/** Base sin la barra final: '' o '/PlayDex'. */
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')

/** URL absoluta de una ruta de la app (links compartidos, redirecciones). */
export function appUrl(path: string): string {
  return `${window.location.origin}${basePath}${path}`
}

/** Ruta de un archivo de public/ (ej. 'icons/icon-192.png'). */
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`
}
