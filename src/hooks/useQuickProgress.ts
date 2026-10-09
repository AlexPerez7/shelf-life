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
 * de lib/media.ts. Es optimista: se ve al instante y se puede tocar seguido.
 */
export function useQuickProgress() {
  const { logActivity, updateItem } = useMedia()
  const { showToast, showError } = useToast()

  /** Película: vista. Serie o anime: el siguiente episodio. */
  async function advance(item: Item) {
    haptic()
    const runtime = item.metadata.runtime_minutes ?? null
    try {
      if (progressKind(item.media_type as NonGameType) === 'none') {
        const pending = logActivity(item.id, { duration_minutes: runtime }, statusChanges(item, 'completed', todayISO()))
        showToast(`${item.title}: vista`)
        await pending
      } else {
        const next = item.progress + 1
        const changes = progressChanges(item, next, todayISO())
        const pending = logActivity(item.id, { duration_minutes: runtime, progress_delta: 1 }, changes)
        showToast(
          changes.status === 'completed' && item.status !== 'completed'
            ? `¡Terminaste ${item.title}!`
            : `${item.title}: ${episodeLabel(next, itemSeasons(item))}`
        )
        await pending
      }
    } catch (err) {
      showError(err, 'No se pudo registrar')
    }
  }

  /**
   * Libro: nueva página actual. Avanzar registra la lectura (con minutos
   * opcionales); retroceder es una corrección y no registra nada.
   */
  async function setPage(item: Item, page: number, minutes: number | null) {
    if (page === item.progress && !minutes) return
    haptic()
    try {
      if (page > item.progress || minutes) {
        const changes = page > item.progress ? progressChanges(item, page, todayISO()) : {}
        const pending = logActivity(
          item.id,
          { duration_minutes: minutes, progress_delta: Math.max(0, page - item.progress) || null },
          changes
        )
        showToast(
          changes.status === 'completed' && item.status !== 'completed'
            ? `¡Terminaste ${item.title}!`
            : page > item.progress
              ? `${item.title}: página ${page}`
              : `${item.title}: ${minutes} min de lectura`
        )
        await pending
      } else {
        await updateItem(item.id, { progress: page })
      }
    } catch (err) {
      showError(err, 'No se pudo guardar la página')
    }
  }

  return { advance, setPage }
}
