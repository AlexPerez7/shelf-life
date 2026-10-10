import { useCallback, useEffect, useRef, useState } from 'react'
import { useGames } from '../../../hooks/useGames'
import { useToast } from '../../../contexts/ToastContext'
import type { Game } from '../../../types/game'
import type { SaveState } from './shared'

/** Espera tras el último cambio antes de guardar (campos de texto, sliders). */
const AUTOSAVE_DELAY = 800

/**
 * Guardado automático del detalle: `draft` guarda SOLO los campos
 * modificados que todavía no se guardaron; lo que se ve en pantalla es el
 * juego del contexto con el draft encima.
 */
export function useGameDraft(id: string | undefined) {
  const { updateGame } = useGames()
  const { showError } = useToast()
  const [draft, setDraft] = useState<Partial<Game>>({})
  const draftRef = useRef<Partial<Game>>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inFlight = useRef<Promise<void> | null>(null)

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current)
    if (!id) return
    // Serializar: si hay un guardado en curso, esperarlo antes de mandar otro.
    if (inFlight.current) await inFlight.current
    const pending = draftRef.current
    if (Object.keys(pending).length === 0) return

    const run = (async () => {
      setSaveState('saving')
      try {
        await updateGame(id, pending)
        // Quitar del draft solo lo que no volvió a cambiar mientras se guardaba.
        const next = { ...draftRef.current }
        for (const key of Object.keys(pending) as (keyof Game)[]) {
          if (next[key] === pending[key]) delete next[key]
        }
        draftRef.current = next
        setDraft(next)
        setSaveState('saved')
      } catch (err) {
        setSaveState('error')
        showError(err, 'No se pudieron guardar los cambios')
      }
    })()
    inFlight.current = run
    await run
    inFlight.current = null
  }, [id, updateGame, showError])

  const setField = useCallback(
    (changes: Partial<Game>, { immediate = false } = {}) => {
      draftRef.current = { ...draftRef.current, ...changes }
      setDraft(draftRef.current)
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(flush, immediate ? 0 : AUTOSAVE_DELAY)
    },
    [flush]
  )

  /** Descarta lo pendiente sin guardarlo (antes de borrar el juego). */
  const discard = useCallback(() => {
    clearTimeout(saveTimer.current)
    draftRef.current = {}
  }, [])

  // Guardar lo pendiente al salir de la pantalla o cuando la app pasa a
  // segundo plano (en mobile el sistema puede matar la PWA sin avisar).
  useEffect(() => {
    function onHide() {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  return { draft, setField, flush, discard, saveState }
}
