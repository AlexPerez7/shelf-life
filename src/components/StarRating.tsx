interface StarRatingProps {
  value: number | null
  onChange: (value: number | null) => void
}

const STAR_COUNT = 5

const STAR_PATH =
  'M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z'

function Star({ fillPercent }: { fillPercent: number }) {
  return (
    <div className="relative h-8 w-8">
      <svg viewBox="0 0 24 24" fill="currentColor" className="absolute inset-0 h-full w-full text-primary-dark/40">
        <path d={STAR_PATH} />
      </svg>
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-[var(--color-star,var(--color-accent))]">
          <path d={STAR_PATH} />
        </svg>
      </div>
    </div>
  )
}

/**
 * Puntaje de 1 a 10 con medias estrellas: tocar la mitad izquierda de una
 * estrella marca la media. Tocar el valor actual lo borra.
 */
export function StarRating({ value, onChange }: StarRatingProps) {
  const points = value ?? 0

  function handleClick(starIndex: number, half: boolean) {
    const next = starIndex * 2 + (half ? 1 : 2)
    onChange(next === points ? null : next)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex" role="group" aria-label="Puntaje">
        {Array.from({ length: STAR_COUNT }).map((_, i) => {
          const filled = points - i * 2
          const fillPercent = filled >= 2 ? 100 : filled === 1 ? 50 : 0
          return (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1} estrella${i > 0 ? 's' : ''} (${(i + 1) * 2}/10)`}
              className="flex h-11 w-10 items-center justify-center"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const half = e.clientX - rect.left < rect.width / 2
                handleClick(i, half)
              }}
            >
              <Star fillPercent={fillPercent} />
            </button>
          )
        })}
      </div>
      <span className="text-sm text-lavender" aria-live="polite">
        {value ? `${value}/10` : 'Sin puntaje'}
      </span>
    </div>
  )
}
