import { useEffect } from 'react'
import type { TrackerId } from './trackers'

/** Fondo de cada tema, para la barra de estado del teléfono. */
const THEME_COLORS: Record<TrackerId, string> = {
  juegos: '#14091f',
  pantalla: '#0b0f17',
  libros: '#f6f2e9',
}

/**
 * Activa el tema de un tracker en <body> (ver body[data-theme] en index.css)
 * mientras se está dentro, y adapta la barra de estado. Al salir vuelve la
 * marca de Shelf Life.
 */
export function useTrackerTheme(tracker: TrackerId) {
  useEffect(() => {
    document.body.dataset.theme = tracker
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const previous = meta?.content
    if (meta) meta.content = THEME_COLORS[tracker]
    return () => {
      delete document.body.dataset.theme
      if (meta && previous) meta.content = previous
    }
  }, [tracker])
}
