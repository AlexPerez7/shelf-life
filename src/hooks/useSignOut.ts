import { useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useConfirm } from '../contexts/ConfirmContext'
import { useGames } from '../contexts/GamesContext'
import { useMedia } from '../contexts/MediaContext'
import { plural } from '../lib/text'

/**
 * Cerrar sesión con confirmación. Antes de preguntar intenta guardar los
 * cambios hechos sin conexión; si igual quedan, lo avisa: al cerrar sesión se
 * descartan (no quedan en el dispositivo para la próxima cuenta).
 * Devuelve `null` si el usuario se arrepiente, o el resultado de `signOut`.
 */
export function useSignOut() {
  const confirm = useConfirm()
  const { flushPending: flushGames, discardPending: discardGames } = useGames()
  const { flushPending: flushMedia, discardPending: discardMedia } = useMedia()

  return useCallback(async () => {
    const pending = (await Promise.all([flushGames(), flushMedia()])).reduce((a, b) => a + b, 0)
    const ok = await confirm(
      pending > 0
        ? {
            title: '¿Cerrar sesión igual?',
            message: `Tienes ${plural(pending, 'cambio hecho', 'cambios hechos')} sin conexión que todavía no se guardaron. Si cierras sesión ahora, se pierden; con señal se guardan solos.`,
            confirmLabel: 'Cerrar sesión y perderlos',
            danger: true,
          }
        : {
            title: '¿Cerrar sesión?',
            message: 'Tus datos quedan guardados en tu cuenta; solo se cierra la sesión en este dispositivo.',
            confirmLabel: 'Cerrar sesión',
            danger: true,
          }
    )
    if (!ok) return null
    // Antes de cerrar: después ya no hay usuario dueño de la cola.
    if (pending > 0) {
      discardGames()
      discardMedia()
    }
    return supabase.auth.signOut()
  }, [confirm, discardGames, discardMedia, flushGames, flushMedia])
}
