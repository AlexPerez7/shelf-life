import { useState } from 'react'
import { useMedia } from '../contexts/MediaContext'
import { useToast } from '../contexts/ToastContext'
import { haptic } from '../lib/haptics'
import { todayISO } from '../lib/dates'
import { episodeLabel, itemSeasons, progressChanges, progressKind, statusChanges } from '../lib/media'
import type { Item, NonGameType } from '../types/item'

/**
 * Avance rápido sin entrar al detalle (biblioteca de Pantalla, inicio):
 * +1 episodio, película vista o página actual de un libro. Registra la
 * actividad (el tiempo lo suma el trigger) y avanza el estado con las reglas
 * de lib/media.ts. `busyId` es el ítem que se está guardando.
 */
export function useQuickProgress() {
  const { logActivity, updateItem } = useMedia()
  const { showToast, showError } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  /** Película: vista. Serie o anime: el siguiente episodio. */
  async function advance(item: Item) {
    if (busyId) return
    setBusyId(item.id)
    haptic()
    const runtime = item.metadata.runtime_minutes ?? null
    try {
      if (progressKind(item.media_type as NonGameType) === 'none') {
        await logActivity(item.id, { duration_minutes: runtime }, statusChanges(item, 'completed', todayISO()))
        showToast(`${item.title}: vista`)
      } else {
        const updated = await logActivity(
          item.id,
          { duration_minutes: runtime, progress_delta: 1 },
          progressChanges(item, item.progress + 1, todayISO())
        )
        showToast(
          updated.status === 'completed' ? `¡Terminaste ${item.title}!` : `${item.title}: ${episodeLabel(updated.progress, itemSeasons(updated))}`
        )
      }
    } catch (err) {
      showError(err, 'No se pudo registrar')
    } finally {
      setBusyId(null)
    }
  }

  /**
   * Libro: nueva página actual. Avanzar registra la lectura (con minutos
   * opcionales); retroceder es una corrección y no registra nada.
   */
  async function setPage(item: Item, page: number, minutes: number | null) {
    if (busyId || page === item.progress) return
    setBusyId(item.id)
    haptic()
    try {
      if (page > item.progress) {
        const updated = await logActivity(
          item.id,
          { duration_minutes: minutes, progress_delta: page - item.progress },
          progressChanges(item, page, todayISO())
        )
        showToast(
          updated.status === 'completed' ? `¡Terminaste ${item.title}!` : `${item.title}: página ${updated.progress}`
        )
      } else {
        await updateItem(item.id, { progress: page })
      }
    } catch (err) {
      showError(err, 'No se pudo guardar la página')
    } finally {
      setBusyId(null)
    }
  }

  return { busyId, advance, setPage }
}
