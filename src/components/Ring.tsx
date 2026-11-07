import type { ReactNode } from 'react'

interface RingProps {
  /** 0 a 100. */
  percent: number
  size: number
  stroke: number
  /** Para lectores de pantalla ("35 por ciento leído"). */
  label: string
  /** Lo que va en el centro (un número, un ícono). */
  children?: ReactNode
}

/** Anillo de avance con el acento del tracker (`stroke-accent`). */
export function Ring({ percent, size, stroke, label, children }: RingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div role="img" aria-label={label} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-ink/15" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="stroke-accent"
        />
      </svg>
      {children != null && (
        <div className="absolute inset-0 flex items-center justify-center text-ink" aria-hidden="true">
          {children}
        </div>
      )}
    </div>
  )
}
