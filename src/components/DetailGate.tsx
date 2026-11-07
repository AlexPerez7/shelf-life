import type { ReactNode } from 'react'
import { Skeleton } from './Skeleton'

interface DetailGateProps {
  /** Ya está cargado el detalle (notas, reseña y sinopsis). */
  ready: boolean
  /** No se pudo cargar (sin conexión). */
  failed: boolean
  children: ReactNode
}

/**
 * Muestra los campos que dependen del detalle recién cuando está cargado:
 * antes estarían vacíos y, al escribir, se pisaría lo que ya hay guardado.
 */
export function DetailGate({ ready, failed, children }: DetailGateProps) {
  if (ready) return <>{children}</>
  if (failed) {
    return (
      <p className="text-sm text-lavender">
        Las notas, la reseña y la sinopsis necesitan conexión para cargarse. Se reintenta solo al volver la señal.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  )
}
