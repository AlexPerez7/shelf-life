import { useGames } from '../../../hooks/useGames'
import { usePlaySessions } from '../../../hooks/usePlaySessions'
import { useSaveStoppedTimer } from '../../../hooks/useSaveStoppedTimer'
import { useSessionTimer } from '../../../contexts/SessionTimerContext'
import { useToast } from '../../../contexts/ToastContext'
import { useConfirm } from '../../../contexts/ConfirmContext'
import { haptic } from '../../../lib/haptics'
import { sessionTimestamp } from '../../../lib/dates'
import type { Game, PlaySession } from '../../../types/game'

/**
 * Sesiones de juego y cronómetro del detalle. Las horas las suma un trigger
 * en la DB al registrar o borrar una sesión (al borrar, se relee el juego).
 * Registrar funciona sin conexión: la sesión espera en la cola de cambios.
 * `flush` manda antes las ediciones pendientes (ej. horas a mano), para que
 * el trigger sume sobre el valor correcto.
 */
export function useGameSessions(
  id: string | undefined,
  current: Game | undefined,
  flush: () => Promise<void>,
  onStartPlaying: () => void
) {
  const { refreshGame } = useGames()
  const { showToast, showError } = useToast()
  const confirm = useConfirm()
  const sessionTimer = useSessionTimer()
  const saveStoppedTimer = useSaveStoppedTimer()
  // Se pasa el id de la URL (no current?.id) para que estas consultas no
  // esperen a que termine de cargar toda la biblioteca antes de arrancar.
  const { sessions, addSession, deleteSession, isPending } = usePlaySessions(id)
  const timerHere = sessionTimer.timer?.gameId === id ? sessionTimer.timer : null

  /**
   * Registra una sesión; las horas las suma un trigger en la DB (y al
   * instante en pantalla). Sin conexión queda en la cola.
   */
  async function registerSession(minutes: number, playedAt: string, notes?: string | null) {
    if (!current) return
    await flush()
    await addSession(minutes, playedAt, notes ?? undefined)
  }

  /** Sesión cargada a mano (minutos y día). Devuelve si se guardó. */
  async function addManualSession(minutes: number, day: string) {
    try {
      await registerSession(minutes, sessionTimestamp(day))
      haptic()
      showToast(`Sesión de ${minutes} min registrada`)
      return true
    } catch (err) {
      showError(err, 'Error al guardar la sesión')
      return false
    }
  }

  /** Cronómetro de otro juego o libro: se guarda en su ítem. */
  async function saveOtherTimer(stopped: NonNullable<ReturnType<typeof sessionTimer.stop>>) {
    try {
      await saveStoppedTimer(stopped)
      showToast(`${stopped.minutes} min guardados en ${stopped.kind === 'book' ? 'tu lectura' : 'la sesión anterior'}`)
    } catch (err) {
      showError(err, 'No se pudo guardar el cronómetro anterior')
    }
  }

  async function startTimer() {
    if (!current) return
    const other = sessionTimer.timer
    if (other && other.gameId !== current.id) {
      const ok = await confirm({
        title: 'Ya hay un cronómetro corriendo',
        message: `Se está midiendo ${other.kind === 'book' ? 'la lectura' : 'una sesión'} de ${other.title}. ¿Detenerla (se guarda) y empezar con este juego?`,
        confirmLabel: 'Detener y empezar',
      })
      if (!ok) return
      const stopped = sessionTimer.stop()
      if (stopped) await saveOtherTimer(stopped)
    }
    sessionTimer.start(current.id, current.title)
    haptic()
    // Empezar a jugar un juego pendiente lo pasa a "Jugando".
    if (current.status === 'pendiente' || current.status === 'en_pausa') onStartPlaying()
  }

  async function stopTimer() {
    const stopped = sessionTimer.stop()
    if (!stopped) return
    haptic([10, 40, 10])
    try {
      await registerSession(stopped.minutes, new Date(stopped.startedAt).toISOString())
      showToast(`Sesión de ${stopped.minutes} min registrada`)
    } catch (err) {
      showError(err, 'Error al guardar la sesión')
    }
  }

  async function cancelTimer() {
    const ok = await confirm({
      title: '¿Descartar el cronómetro?',
      message: 'El tiempo medido no se va a guardar.',
      confirmLabel: 'Descartar',
      danger: true,
    })
    if (ok) sessionTimer.cancel()
  }

  async function removeSession(session: PlaySession) {
    if (!current) return
    try {
      await flush()
      const wasPending = await deleteSession(session.id)
      if (!wasPending) await refreshGame(current.id)
      showToast(`Sesión de ${session.duration_minutes} min eliminada`, {
        duration: 5000,
        action: {
          label: 'Deshacer',
          onClick: () => {
            // Se vuelve a insertar (el trigger vuelve a sumar las horas).
            registerSession(session.duration_minutes, session.played_at, session.notes).catch(
              (err) => showError(err, 'No se pudo restaurar la sesión')
            )
          },
        },
      })
    } catch (err) {
      showError(err, 'No se pudo eliminar la sesión')
    }
  }

  return {
    sessions,
    isPending,
    timerStartedAt: timerHere?.startedAt ?? null,
    addManualSession,
    startTimer,
    stopTimer,
    cancelTimer,
    removeSession,
  }
}
