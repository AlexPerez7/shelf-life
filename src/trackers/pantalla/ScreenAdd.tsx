import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bookmark, Check, Eye, Flame, Loader2, PenLine, Play, Search, X } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { useToast } from '../../contexts/ToastContext'
import { PageContainer } from '../../components/PageContainer'
import { GameThumb } from '../../components/GameThumb'
import { Skeleton } from '../../components/Skeleton'
import { BottomSheet } from '../../components/BottomSheet'
import { MediaForm } from '../../components/MediaForm'
import { useMediaSearch } from '../../hooks/useMediaSearch'
import { useTrending } from '../../hooks/useTrending'
import { haptic } from '../../lib/haptics'
import { todayISO } from '../../lib/dates'
import {
  formatMinutes,
  mediaSections,
  mediaTypeIcons,
  mediaTypeLabels,
  mediaTypePlurals,
  needsDetails,
  resultToItemWithStatus,
  withDetails,
} from '../../lib/media'
import type { Item, ItemStatus, ItemWrite, MediaSearchResult, ScreenType } from '../../types/item'

const section = mediaSections.pantalla

const resultKey = (r: Pick<MediaSearchResult, 'source' | 'external_id'>) => `${r.source}:${r.external_id}`

/** Estados con los que se puede agregar directo desde la búsqueda. */
const ADD_OPTIONS: { status: ItemStatus; label: string; Icon: typeof Bookmark }[] = [
  { status: 'wishlist', label: 'Quiero ver', Icon: Bookmark },
  { status: 'in_progress', label: 'Viendo', Icon: Play },
  { status: 'completed', label: 'Ya la vi', Icon: Eye },
]

/** "2019 · 24 ep." / "2019 · 2h 10m". */
function resultFacts(r: MediaSearchResult) {
  return [
    r.release_date?.slice(0, 4),
    r.media_type === 'movie'
      ? r.runtime_minutes && formatMinutes(r.runtime_minutes)
      : r.episodes && `${r.episodes} ep.`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Alta de Pantalla: búsqueda en TMDB (películas, series) o AniList (anime)
 * con resultados como pósters y, antes de escribir, las tendencias. Tocar uno
 * abre una vista previa desde la que se agrega directo como "Quiero ver",
 * "Viendo" o "Ya la vi", sin salir de la búsqueda, así se pueden agregar
 * varios seguidos.
 */
export function ScreenAdd() {
  const navigate = useNavigate()
  const { items, addItem } = useMedia()
  const { showToast, showError } = useToast()

  const [params, setParams] = useSearchParams()
  const typeParam = params.get('tipo') ?? ''
  const type: ScreenType = (section.types as string[]).includes(typeParam)
    ? (typeParam as ScreenType)
    : 'movie'
  function setType(next: ScreenType) {
    setParams({ tipo: next }, { replace: true })
  }

  const [query, setQuery] = useState('')
  const { active: hasQuery, results, error: searchError, searching } = useMediaSearch(type, query)

  // Ya agregados, por origen + id externo.
  const existing = useMemo(() => {
    const map = new Map<string, Item>()
    for (const i of items) if (i.source && i.external_id) map.set(`${i.source}:${i.external_id}`, i)
    return map
  }, [items])

  // Vista previa: el resultado tocado, completado con su detalle en segundo plano.
  const [preview, setPreview] = useState<MediaSearchResult | null>(null)
  const [details, setDetails] = useState<Record<string, MediaSearchResult>>({})
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [adding, setAdding] = useState<ItemStatus | null>(null)

  function openPreview(result: MediaSearchResult) {
    setPreview(result)
    const key = resultKey(result)
    if (details[key] || !needsDetails(result)) return
    setLoadingDetails(true)
    withDetails(result)
      .then((full) => setDetails((prev) => ({ ...prev, [key]: full })))
      .finally(() => setLoadingDetails(false))
  }

  const shown = preview ? (details[resultKey(preview)] ?? preview) : null
  const shownExisting = preview ? existing.get(resultKey(preview)) : undefined

  async function handleAdd(status: ItemStatus) {
    if (!preview || adding) return
    setAdding(status)
    haptic()
    try {
      const full = details[resultKey(preview)] ?? (await withDetails(preview))
      const created = await addItem(resultToItemWithStatus(full, status, todayISO()))
      setPreview(null)
      showToast(`${created.title}: ${section.statusLabels[status]}`)
    } catch (err) {
      showError(err, 'No se pudo agregar')
    } finally {
      setAdding(null)
    }
  }

  const [manualOpen, setManualOpen] = useState(false)

  /** Alta manual: lo que no está en TMDB ni AniList. */
  async function handleManualAdd(data: ItemWrite & Pick<Item, 'media_type' | 'title'>) {
    const today = todayISO()
    if (data.status === 'in_progress') data.date_started = today
    if (data.status === 'completed') data.date_finished = today
    const created = await addItem(data)
    showToast(`Agregaste ${created.title} a tu biblioteca`)
    navigate(section.detailPath(created.id), { replace: true })
  }

  const TypeIcon = mediaTypeIcons[type]
  const trending = useTrending(type)

  /** Póster de un resultado o tendencia; tocarlo abre la vista previa. */
  function renderPoster(r: MediaSearchResult) {
    const added = existing.get(resultKey(r))
    return (
      <button
        key={resultKey(r)}
        type="button"
        onClick={() => openPreview(r)}
        className="relative block text-left transition-transform active:scale-[0.97]"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-primary-dark/30 ring-1 ring-primary-dark/40">
          <GameThumb
            src={r.cover_url}
            alt=""
            className="h-full w-full object-cover"
            placeholderClassName="text-3xl"
            icon={mediaTypeIcons[r.media_type]}
          />
          {added && (
            <span
              aria-label="Ya está en tu biblioteca"
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-primary-darker shadow"
            >
              <Check size={15} />
            </span>
          )}
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-tight text-ink">{r.title}</p>
        <p className="truncate text-[11px] text-lavender">{resultFacts(r) || mediaTypeLabels[r.media_type]}</p>
      </button>
    )
  }


  return (
    <PageContainer>
      <button
        onClick={() => navigate(section.libraryPath)}
        className="-ml-2 mb-1 flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/30"
      >
        <ArrowLeft size={16} /> Pantalla
      </button>
      <h1 className="mb-2 text-3xl font-bold text-ink">Agregar</h1>

      <div role="group" aria-label="Tipo" className="-mx-1 mb-3 flex gap-1">
        {section.types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t as ScreenType)}
            aria-pressed={t === type}
            className={`relative min-h-11 px-3 text-sm font-semibold transition-colors ${
              t === type
                ? 'text-ink after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:rounded-full after:bg-accent'
                : 'text-lavender'
            }`}
          >
            {mediaTypePlurals[t]}
          </button>
        ))}
      </div>

      <div className="relative mb-4 md:max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lavender"
        />
        <input
          type="search"
          enterKeyHint="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Buscar ${type === 'anime' ? 'anime' : mediaTypePlurals[type].toLowerCase()}...`}
          aria-label="Buscar"
          className="w-full rounded-xl bg-background-surface py-3 pl-9 pr-10 text-base text-ink ring-1 ring-primary-dark/40 [&::-webkit-search-cancel-button]:hidden focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Borrar búsqueda"
            className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-lavender"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {searchError && <p className="mb-3 rounded-xl bg-error/10 p-3 text-sm text-error">{searchError}</p>}

      {!hasQuery && trending == null && (
        <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full" />
          ))}
        </div>
      )}

      {!hasQuery && trending != null && trending.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-lg font-semibold text-ink">
            <Flame size={18} className="text-accent" /> Tendencias {type === 'anime' ? 'de la temporada' : 'de la semana'}
          </h2>
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
            {trending.map(renderPoster)}
          </div>
        </section>
      )}

      {!hasQuery && trending != null && trending.length === 0 && (
        <div className="mt-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
            <TypeIcon size={26} />
          </div>
          <p className="max-w-xs text-sm text-lavender">
            Busca {type === 'movie' ? 'una película' : type === 'series' ? 'una serie' : 'un anime'} y
            tócala para ver de qué se trata y agregarla.
          </p>
        </div>
      )}

      {hasQuery && searching && results.length === 0 && (
        <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full" />
          ))}
        </div>
      )}

      {hasQuery && !searching && results.length === 0 && !searchError && (
        <p className="mb-3 mt-6 text-center text-sm text-lavender">Sin resultados.</p>
      )}

      {hasQuery && results.length > 0 && (
        <div
          className={`grid grid-cols-3 gap-x-3 gap-y-4 transition-opacity sm:grid-cols-4 lg:grid-cols-6 ${
            searching ? 'opacity-60' : ''
          }`}
        >
          {results.map(renderPoster)}
        </div>
      )}

      <button
        type="button"
        onClick={() => setManualOpen(true)}
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-accent ring-1 ring-primary-dark/50 active:bg-primary-dark/30 md:max-w-md"
      >
        <PenLine size={16} />
        {hasQuery ? `Agregar “${query.trim()}” a mano` : 'Agregar a mano'}
      </button>
      <p className="mt-2 text-xs text-lavender md:max-w-md">
        Para lo que no aparece en la búsqueda: completas tú los datos.
      </p>

      <BottomSheet open={preview != null} onClose={() => setPreview(null)} title={shown?.title ?? 'Vista previa'}>
        {shown && (
          <div>
            <div className="flex gap-4">
              <div className="aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-lg bg-primary-dark/30 shadow-lg shadow-black/40 ring-1 ring-white/10">
                <GameThumb
                  src={shown.cover_url}
                  alt=""
                  className="h-full w-full object-cover"
                  placeholderClassName="text-4xl"
                  icon={mediaTypeIcons[shown.media_type]}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                  {mediaTypeLabels[shown.media_type]}
                </p>
                {shown.original_title && shown.original_title !== shown.title && (
                  <p className="text-xs italic text-lavender">{shown.original_title}</p>
                )}
                <p className="mt-1 flex items-center gap-1.5 text-sm text-lavender">
                  {resultFacts(shown)}
                  {loadingDetails && <Loader2 size={13} className="animate-spin" aria-label="Cargando detalle" />}
                </p>
                {shown.genres.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {shown.genres.slice(0, 4).map((g) => (
                      <span
                        key={g}
                        className="rounded-full bg-background px-2 py-0.5 text-[11px] text-lavender ring-1 ring-primary-dark/40"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {shown.summary && (
              <p className="mt-4 line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-lavender">
                {shown.summary}
              </p>
            )}

            {shownExisting ? (
              <button
                type="button"
                onClick={() => navigate(section.detailPath(shownExisting.id))}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-background font-semibold text-accent ring-1 ring-primary-dark/50"
              >
                <Check size={18} /> En tu biblioteca: {section.statusLabels[shownExisting.status]}
              </button>
            ) : (
              <div className="mt-5 grid grid-cols-3 gap-2">
                {ADD_OPTIONS.map(({ status, label, Icon }) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleAdd(status)}
                    disabled={adding != null}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold transition-transform active:scale-95 disabled:opacity-60 ${
                      status === 'wishlist'
                        ? 'bg-accent text-primary-darker'
                        : 'bg-background text-ink ring-1 ring-primary-dark/50'
                    }`}
                  >
                    {adding === status ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={manualOpen} onClose={() => setManualOpen(false)} title="Agregar a mano">
        {manualOpen && (
          <MediaForm
            section={section}
            initialTitle={query.trim()}
            initialType={type}
            submitLabel="Agregar"
            onSubmit={handleManualAdd}
          />
        )}
      </BottomSheet>
    </PageContainer>
  )
}
