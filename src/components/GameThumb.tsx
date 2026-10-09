import { useState } from 'react'
import { Gamepad2, type LucideIcon } from 'lucide-react'
import { sizedCover, type CoverSize } from '../lib/images'

interface GameThumbProps {
  src: string | null
  alt: string
  /** URLs alternativas a probar, en orden, si `src` falla. */
  fallbacks?: string[]
  /** Clases para la imagen y para el placeholder (mismo tamaño). */
  className?: string
  /** Clases extra solo para el placeholder (ej. tamaño del emoji). */
  placeholderClassName?: string
  /** Cargar de inmediato (imágenes visibles al abrir la pantalla, ej. portada hero). */
  eager?: boolean
  /** Ícono del placeholder (por defecto, un control de juego). */
  icon?: LucideIcon
  /** Tamaño a pedir al CDN (ver lib/images.ts); sin él, la URL tal cual. */
  size?: CoverSize
}

/**
 * Portada de un juego con degradado: prueba `src`, luego cada `fallback`, y si
 * todo falla muestra un placeholder. Necesario sobre todo para Steam: algunas
 * apps (títulos de EA, lanzamientos muy nuevos) no tienen `header.jpg` en el
 * CDN y devuelven 404.
 */
export function GameThumb({
  src,
  alt,
  fallbacks = [],
  className = '',
  placeholderClassName = '',
  eager = false,
  icon: Icon = Gamepad2,
  size,
}: GameThumbProps) {
  const sized = size ? sizedCover(src, size) : src
  // Si el tamaño chico no existe, se prueba el original antes que los fallbacks.
  const chain = sized ? [...new Set([sized, src!, ...fallbacks])] : []
  const [index, setIndex] = useState(0)

  if (index >= chain.length) {
    return (
      <div
        className={`flex items-center justify-center bg-primary-dark/20 text-lavender/50 ${className} ${placeholderClassName}`}
      >
        <Icon className="h-[1em] w-[1em]" />
      </div>
    )
  }

  return (
    <img
      key={chain[index]}
      src={chain[index]}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setIndex((i) => i + 1)}
      className={className}
    />
  )
}
