import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { TrackerId } from '../../trackers/trackers'

/**
 * Algo en curso, listo para dibujar: lo comparten la tarjeta protagonista
 * ("Continuar") y las del carrusel. Las acciones ya traen sus manejadores.
 */
export interface NowModel {
  key: string
  tracker: TrackerId
  to: string
  cover: string | null
  icon: LucideIcon
  /** "Leyendo · Libros". */
  kicker: string
  title: string
  /** Autor o tipo ("Frank Herbert", "Serie"). */
  byline: string
  /** "Página 212 de 612" o "12 h jugadas". */
  progress: ReactNode
  /** 0 a 100, o null si no se mide (juegos). */
  pct: number | null
  /** Botones de la tarjeta grande. */
  primary: ReactNode
  /** Botón redondo de un toque sobre la portada del carrusel (null si no hay acción posible). */
  quick: ReactNode
}
