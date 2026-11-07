import type { StatPart } from '../lib/screenStats'

/** Línea de resumen de una biblioteca: los números en negrita separados por puntos. */
export function SummaryLine({ parts, className = 'mb-5' }: { parts: StatPart[]; className?: string }) {
  return (
    <p className={`${className} text-sm leading-relaxed text-lavender`}>
      {parts.map((p, i) => (
        <span key={p.label} className="whitespace-nowrap">
          {i > 0 && <span aria-hidden="true"> · </span>}
          <strong className="font-semibold tabular-nums text-ink">{p.value}</strong> {p.label}
          {i < parts.length - 1 && ' '}
        </span>
      ))}
    </p>
  )
}
