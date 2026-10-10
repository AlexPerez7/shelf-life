import { useState } from 'react'
import { MoreVertical, X } from 'lucide-react'
import { GameThumb } from '../../../components/GameThumb'
import { heroCover } from './shared'

interface GameHeroProps {
  title: string
  coverUrl: string | null
  onBack: () => void
  onChangeCover: () => void
  onDelete: () => void
}

/** Portada grande del detalle, con volver y el menú ⋮ (cambiar portada, eliminar). */
export function GameHero({ title, coverUrl, onBack, onChangeCover, onDelete }: GameHeroProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="relative h-64 w-full overflow-hidden bg-primary-dark/20 md:h-80">
      <GameThumb
        src={heroCover(coverUrl)}
        fallbacks={coverUrl ? [coverUrl] : []}
        alt={title}
        eager
        className="h-full w-full object-cover"
        placeholderClassName="text-5xl"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, var(--color-background) 0%, transparent 55%)',
        }}
      />
      {/* Tocar la portada abre "Cambiar portada" (también está en el menú ⋮). */}
      <button
        type="button"
        onClick={onChangeCover}
        aria-label="Cambiar portada"
        className="absolute inset-0"
      />

      {/* Botones sobre la portada: respetan el notch / isla dinámica. */}
      <div
        className="absolute inset-x-4 flex items-start justify-between"
        style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <button
          onClick={onBack}
          aria-label="Volver"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-background/70 text-ink backdrop-blur"
        >
          <X size={20} />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Más opciones"
            aria-expanded={menuOpen}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-background/70 text-ink backdrop-blur"
          >
            <MoreVertical size={20} />
          </button>
          {menuOpen && (
            <>
              {/* Capa invisible: tocar fuera cierra el menú. */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl bg-background-surface p-1 shadow-lg ring-1 ring-primary-dark/30">
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onChangeCover()
                  }}
                  className="w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-ink active:bg-primary-dark/20"
                >
                  Cambiar portada
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete()
                  }}
                  className="w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-error active:bg-error/10"
                >
                  Eliminar juego
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
