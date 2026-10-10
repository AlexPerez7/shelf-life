import type { Ref } from 'react'
import { StickyNote } from 'lucide-react'
import { SectionCard } from '../../../components/SectionCard'
import type { Game } from '../../../types/game'
import { inputClass } from './shared'

interface NotesCardProps {
  notes: string | null
  review: string | null
  setField: (changes: Partial<Game>) => void
  /** Para el botón de notas de arriba, que baja hasta acá. */
  sectionRef?: Ref<HTMLDivElement>
}

export function NotesCard({ notes, review, setField, sectionRef }: NotesCardProps) {
  return (
    <div ref={sectionRef} className="scroll-mt-20">
      <SectionCard icon={StickyNote} title="Notas y reseña">
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-lavender">Notas</span>
            <textarea
              value={notes ?? ''}
              onChange={(e) => setField({ notes: e.target.value })}
              rows={3}
              placeholder="Notas de progreso, spoilers, pendientes..."
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-lavender">Reseña</span>
            <textarea
              value={review ?? ''}
              onChange={(e) => setField({ review: e.target.value })}
              rows={4}
              placeholder="Tu opinión sobre el juego..."
              className={inputClass}
            />
          </label>
        </div>
      </SectionCard>
    </div>
  )
}
