import { useState } from 'react'

/** Sinopsis recortada a unas líneas, con "Ver más". */
export function Synopsis({ text, className = '' }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false)
  const long = text.length > 280
  return (
    <div className={className}>
      <p
        className={`whitespace-pre-line text-sm leading-relaxed text-lavender ${
          long && !expanded ? 'line-clamp-4' : ''
        }`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="-ml-2 mt-1 min-h-11 rounded-full px-2 text-sm font-semibold text-accent active:bg-primary-dark/30"
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  )
}
