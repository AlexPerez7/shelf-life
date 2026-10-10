import { AlertCircle, ArrowLeft, CheckCircle2, Heart, Loader2 } from 'lucide-react'
import type { SaveState } from './shared'

export function SaveIndicator({
  state,
  onRetry,
  compact = false,
}: {
  state: SaveState
  onRetry: () => void
  /** Versión para la cabecera compacta: solo ícono. */
  compact?: boolean
}) {
  if (state === 'idle') return null
  if (compact) {
    if (state === 'error') {
      return (
        <button onClick={onRetry} aria-label="Reintentar guardado" className="flex h-11 w-9 items-center justify-center text-error">
          <AlertCircle size={16} />
        </button>
      )
    }
    return state === 'saving' ? (
      <Loader2 size={16} className="flex-shrink-0 animate-spin text-lavender" aria-label="Guardando" />
    ) : (
      <CheckCircle2 size={16} className="flex-shrink-0 text-accent" aria-label="Guardado" />
    )
  }
  if (state === 'error') {
    return (
      <button
        onClick={onRetry}
        className="mt-1.5 flex flex-shrink-0 items-center gap-1 text-xs font-medium text-error"
      >
        <AlertCircle size={14} /> Reintentar
      </button>
    )
  }
  return (
    <span
      aria-live="polite"
      className="mt-1.5 flex flex-shrink-0 items-center gap-1 text-xs text-lavender"
    >
      {state === 'saving' ? (
        <>
          <Loader2 size={14} className="animate-spin" /> Guardando
        </>
      ) : (
        <>
          <CheckCircle2 size={14} className="text-accent" /> Guardado
        </>
      )}
    </span>
  )
}

/** Cabecera fija que aparece cuando el título grande sale de pantalla. */
export function CompactHeader({
  visible,
  title,
  isFavorite,
  saveState,
  onBack,
  onRetry,
  onToggleFavorite,
}: {
  visible: boolean
  title: string
  isFavorite: boolean
  saveState: SaveState
  onBack: () => void
  onRetry: () => void
  onToggleFavorite: () => void
}) {
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 top-0 z-30 border-b border-primary-dark/30 bg-background/95 transition-transform duration-200 ${
        visible ? 'translate-y-0' : 'pointer-events-none -translate-y-full'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-2">
        <button
          onClick={onBack}
          aria-label="Volver"
          tabIndex={visible ? 0 : -1}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink active:bg-primary-dark/20"
        >
          <ArrowLeft size={20} />
        </button>
        <p className="min-w-0 flex-1 truncate font-semibold text-ink">{title}</p>
        <SaveIndicator state={saveState} onRetry={onRetry} compact />
        <button
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
          tabIndex={visible ? 0 : -1}
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full active:bg-primary-dark/20 ${
            isFavorite ? 'text-accent' : 'text-lavender'
          }`}
        >
          <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  )
}
