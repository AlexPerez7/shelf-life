import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Eye, Loader2, Play, Plus } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { useToast } from '../../contexts/ToastContext'
import { GameThumb } from '../../components/GameThumb'
import { SectionCard } from '../../components/SectionCard'
import { haptic } from '../../lib/haptics'
import { todayISO } from '../../lib/dates'
import { animeSequels, mediaSections, resultToItemWithStatus, type AnimeSequel } from '../../lib/media'
import type { Item, ItemStatus } from '../../types/item'

const section = mediaSections.pantalla

/** Cómo se llama cada formato de AniList. */
const FORMAT_LABELS: Record<string, string> = {
  TV: 'Temporada siguiente',
  TV_SHORT: 'Temporada siguiente',
  ONA: 'Temporada siguiente (web)',
  MOVIE: 'Película',
  OVA: 'OVA',
  SPECIAL: 'Especial',
}

// Por sesión de la app: las secuelas de un anime cambian muy poco.
const cache = new Map<string, AnimeSequel[]>()

/**
 * "Sigue la historia": al terminar un anime de AniList, sus secuelas (la
 * temporada siguiente, películas, OVAs) para agregarlas con un toque. Las que
 * ya están en Pantalla llevan a su ficha.
 */
export function NextSeason({ item }: { item: Item }) {
  const anilistId = item.external_id!
  const { items, addItem } = useMedia()
  const { showToast, showError } = useToast()
  const navigate = useNavigate()
  const [sequels, setSequels] = useState<AnimeSequel[] | null>(() => cache.get(anilistId) ?? null)
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => {
    if (cache.has(anilistId)) return
    let cancelled = false
    animeSequels(anilistId)
      .catch(() => [] as AnimeSequel[])
      .then((list) => {
        cache.set(anilistId, list)
        if (!cancelled) setSequels(list)
      })
    return () => {
      cancelled = true
    }
  }, [anilistId])

  if (!sequels || sequels.length === 0) return null

  async function add(sequel: AnimeSequel, status: ItemStatus) {
    haptic()
    setAdding(sequel.external_id)
    try {
      const created = await addItem({ ...resultToItemWithStatus(sequel, status, todayISO()), format: item.format })
      showToast(`${sequel.title}: ${section.statusLabels[status].toLowerCase()}`)
      if (status === 'in_progress') navigate(section.detailPath(created.id))
    } catch (err) {
      showError(err, 'No se pudo agregar')
    } finally {
      setAdding(null)
    }
  }

  return (
    <SectionCard icon={ChevronRight} title="Sigue la historia">
      <ul className="flex flex-col gap-3">
        {sequels.slice(0, 3).map((s) => {
          const inLibrary = items.find((i) => i.source === 'anilist' && i.external_id === s.external_id)
          return (
            <li key={s.external_id} className="flex gap-3">
              <div className="aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-md bg-primary-dark/40 ring-1 ring-white/10">
                <GameThumb size="thumb" src={s.cover_url} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-lavender">
                  {FORMAT_LABELS[s.format ?? ''] ?? 'Secuela'}
                  {s.episodes ? ` · ${s.episodes} ep.` : ''}
                  {s.release_date ? ` · ${s.release_date.slice(0, 4)}` : ''}
                </p>
                <p className="line-clamp-2 font-semibold text-ink">{s.title}</p>
                {inLibrary ? (
                  <button
                    type="button"
                    onClick={() => navigate(section.detailPath(inLibrary.id))}
                    className="-ml-2 mt-1 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-accent active:bg-primary-dark/30"
                  >
                    <Eye size={15} /> Ya está en Pantalla · {section.statusLabels[inLibrary.status]}
                  </button>
                ) : adding === s.external_id ? (
                  <p className="mt-1 flex min-h-11 items-center gap-1.5 text-sm text-lavender">
                    <Loader2 size={15} className="animate-spin" /> Agregando...
                  </p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => add(s, 'in_progress')}
                      className="flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-semibold text-primary-darker active:scale-95"
                    >
                      <Play size={14} fill="currentColor" /> Empezar a ver
                    </button>
                    <button
                      type="button"
                      onClick={() => add(s, 'wishlist')}
                      className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-accent ring-1 ring-primary-dark/50 active:bg-primary-dark/30"
                    >
                      <Plus size={14} /> Quiero ver
                    </button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}
