// Shelf Life son tres trackers en uno. Cada uno vive bajo su propia ruta,
// con su navegación, su color de acento (ver index.css, [data-tracker]) y su
// carpeta en src/trackers/, para poder darle un diseño propio.

import { BookOpen, Gamepad2, Tv, type LucideIcon } from 'lucide-react'

export type TrackerId = 'juegos' | 'pantalla' | 'libros'

export const trackerIds: TrackerId[] = ['juegos', 'pantalla', 'libros']

export const trackers: Record<
  TrackerId,
  { label: string; Icon: LucideIcon; base: string; tagline: string }
> = {
  juegos: { label: 'Juegos', Icon: Gamepad2, base: '/juegos', tagline: 'Backlog, horas y progreso' },
  pantalla: {
    label: 'Pantalla',
    Icon: Tv,
    base: '/pantalla',
    tagline: 'Películas, series y anime',
  },
  libros: { label: 'Libros', Icon: BookOpen, base: '/libros', tagline: 'Lecturas y páginas' },
}

/** Tracker al que pertenece una ruta (null en el inicio y rutas comunes). */
export function trackerForPath(pathname: string): TrackerId | null {
  return trackerIds.find((id) => pathname === trackers[id].base || pathname.startsWith(`${trackers[id].base}/`)) ?? null
}
