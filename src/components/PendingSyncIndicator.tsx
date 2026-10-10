import { useEffect, useState } from 'react'
import { CloudOff, Loader2 } from 'lucide-react'
import { useGames } from '../contexts/GamesContext'
import { useMedia } from '../contexts/MediaContext'
import { useToast } from '../contexts/ToastContext'
import { haptic } from '../lib/haptics'

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

/**
 * Aviso chico arriba a la derecha cuando hay cambios hechos sin conexión
 * que todavía no llegaron a la base. Tocarlo intenta guardarlos ya. Si al
 * reintentar la base rechaza alguno, lo avisa con un toast.
 */
export function PendingSyncIndicator() {
  const games = useGames()
  const media = useMedia()
  const { showToast, showError } = useToast()
  const online = useOnline()
  const [saving, setSaving] = useState(false)
  const pending = games.pendingCount + media.pendingCount

  const gamesError = games.syncError
  const mediaError = media.syncError
  useEffect(() => {
    if (gamesError) showError(new Error(gamesError.message), 'Un cambio hecho sin conexión no se pudo guardar')
  }, [gamesError, showError])
  useEffect(() => {
    if (mediaError) showError(new Error(mediaError.message), 'Un cambio hecho sin conexión no se pudo guardar')
  }, [mediaError, showError])

  if (pending === 0) return null

  async function handleClick() {
    haptic()
    if (!navigator.onLine) {
      showToast('Sin conexión: se guardan solos cuando vuelva la señal')
      return
    }
    setSaving(true)
    const left = (await Promise.all([games.flushPending(), media.flushPending()])).reduce((a, b) => a + b, 0)
    setSaving(false)
    if (left === 0) showToast('Cambios guardados')
    else showToast('Todavía no se pudieron guardar; se reintenta solo')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-live="polite"
      className="toast-in fixed right-3 z-30 flex min-h-11 items-center gap-1.5 rounded-full bg-background-surface px-3 text-xs font-semibold text-ink shadow-lg shadow-black/30 ring-1 ring-primary-dark/40"
      style={{ top: 'calc(0.5rem + env(safe-area-inset-top))' }}
    >
      {saving ? (
        <Loader2 size={14} className="animate-spin text-accent" />
      ) : (
        <CloudOff size={14} className={online ? 'text-accent' : 'text-lavender'} />
      )}
      {pending === 1 ? '1 cambio sin guardar' : `${pending} cambios sin guardar`}
    </button>
  )
}
