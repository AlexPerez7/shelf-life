import { useState } from 'react'
import { Info } from 'lucide-react'
import { SectionCard } from '../../../components/SectionCard'

/** Sinopsis del juego, recortada a 4 líneas con "Leer más". */
export function AboutCard({ summary }: { summary: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <SectionCard icon={Info} title="Acerca de">
      <p className={`text-sm text-lavender ${!expanded ? 'line-clamp-4' : ''}`}>{summary}</p>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="-mx-2 mt-1 min-h-11 rounded-lg px-2 text-sm font-medium text-accent"
      >
        {expanded ? 'Leer menos' : 'Leer más'}
      </button>
    </SectionCard>
  )
}
