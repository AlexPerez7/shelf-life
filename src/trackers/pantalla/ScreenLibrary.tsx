import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight, Plus, Search, X } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { useToast } from '../../contexts/ToastContext'
import { PageContainer } from '../../components/PageContainer'
import { TrackerBar } from '../../components/TrackerBar'
import { MediaCoverCard } from '../../components/MediaCoverCard'
import { ItemStatusSheet } from '../../components/ItemStatusSheet'
import { GameThumb } from '../../components/GameThumb'
import { Skeleton } from '../../components/Skeleton'
import { useQuickProgress } from '../../hooks/useQuickProgress'
import { haptic } from '../../lib/haptics'
import { todayISO } from '../../lib/dates'
import {
  formatMinutes,
  itemStatuses,
  mediaSections,
  mediaTypeIcons,
  mediaTypeLabels,
  mediaTypePlurals,
  progressKind,
  statusChanges,
} from '../../lib/media'
import type { Item, ItemStatus, ScreenType } from '../../types/item'

const section = mediaSections.pantalla
type TypeFilter = ScreenType | 'todos'

/** Filas del inicio de Pantalla, en orden (lo que se está viendo va arriba aparte). */
const RAILS: { status: ItemStatus; title: string }[] = [
  { status: 'wishlist', title: 'Quiero ver' },
  { status: 'planned', title: 'Pendientes' },
  { status: 'paused', title: 'En pausa' },
  { status: 'completed', title: 'Vistos' },
  { status: 'dropped', title: 'Abandonados' },
]

const byRecent = (a: Item, b: Item) => b.updated_at.localeCompare(a.updated_at)
const byFinished = (a: Item, b: Item) =>
  (b.date_finished ?? b.updated_at).localeCompare(a.date_finished ?? a.updated_at)

/** Franja de números de Pantalla. */
function Stats({ items }: { items: Item[] }) {
  const minutes = items.reduce((s, i) => s + i.time_spent_minutes, 0)
  const movies = items.filter((i) => i.media_type === 'movie' && i.status === 'completed').length
  const episodes = items
    .filter((i) => i.media_type !== 'movie')
    .reduce((s, i) => s + i.progress, 0)
  const watching = items.filter((i) => i.status === 'in_progress').length

  const cells = [
    { value: String(items.length), label: 'Títulos' },
    { value: String(watching), label: 'Viendo' },
    { value: String(movies), label: 'Películas vistas' },
    { value: episodes.toLocaleString(), label: 'Episodios' },
    { value: minutes > 0 ? formatMinutes(minutes) : '—', label: 'Frente a la pantalla' },
  ]

  return (
    <div className="scrollbar-hide -mx-4 mb-5 flex overflow-x-auto px-4">
      <div className="flex divide-x divide-primary-dark/40 rounded-2xl bg-background-surface ring-1 ring-primary-dark/40">
        {cells.map((c) => (
          <div key={c.label} className="flex min-w-[5.5rem] flex-col items-center px-3 py-2.5">
            <p className="text-xl font-bold tabular-nums text-accent">{c.value}</p>
            <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-lavender">
              {c.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Avance legible de una serie o anime: "Episodio 5 de 12". */
function episodeLine(item: Item) {
  const total = item.progress_total
  if (item.progress === 0) return total ? `${total} episodios` : 'Sin empezar'
  return total ? `Episodio ${item.progress} de ${total}` : `Episodio ${item.progress}`
}

interface ContinueCardProps {
  item: Item
  busy: boolean
  onOpen: () => void
  onAdvance: () => void
}

/** Tarjeta de "Seguir viendo": portada sobre su propio fondo difuminado y avance rápido. */
function ContinueCard({ item, busy, onOpen, onAdvance }: ContinueCardProps) {
  const type = item.media_type as ScreenType
  const isMovie = progressKind(type) === 'none'
  const runtime = item.metadata.runtime_minutes
  const pct = item.progress_total ? Math.min(100, (item.progress / item.progress_total) * 100) : null
  const nextEpisode = item.progress + 1

  return (
    <div className="relative overflow-hidden rounded-2xl bg-background-surface ring-1 ring-primary-dark/40">
      {item.cover_url && (
        <img
          src={item.cover_url}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-2xl"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-background-surface/70 to-background-surface/90" />

      <div className="relative flex gap-3 p-3">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Abrir ${item.title}`}
          className="w-20 shrink-0 overflow-hidden rounded-lg shadow-lg shadow-black/40 ring-1 ring-white/10 transition-transform active:scale-[0.97]"
        >
          <GameThumb
            src={item.cover_url}
            alt=""
            className="aspect-[2/3] w-full object-cover"
            placeholderClassName="text-2xl"
            icon={mediaTypeIcons[type]}
          />
        </button>

        <div className="flex min-w-0 flex-1 flex-col">
          <button type="button" onClick={onOpen} className="min-w-0 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
              {mediaTypeLabels[type]}
            </p>
            <p className="line-clamp-2 font-semibold leading-tight text-ink">{item.title}</p>
            <p className="mt-0.5 text-xs text-lavender">
              {isMovie
                ? runtime
                  ? formatMinutes(runtime)
                  : 'Película'
                : [episodeLine(item), runtime ? `${runtime}m c/u` : null].filter(Boolean).join(' · ')}
            </p>
          </button>

          {pct != null && (
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40"
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Avance"
            >
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          )}

          <div className="mt-auto flex justify-end pt-2">
            <button
              type="button"
              onClick={onAdvance}
              disabled={busy}
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-primary-darker transition-transform active:scale-95 disabled:opacity-60"
            >
              {isMovie ? (
                <>
                  <Check size={16} /> La vi
                </>
              ) : (
                <>
                  <Plus size={16} /> Ep. {nextEpisode}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface RailProps {
  title: string
  items: Item[]
  onSeeAll: () => void
  onOpen: (item: Item) => void
  onStatusClick: (item: Item) => void
}

/** Fila horizontal de pósters, como en las apps de streaming. */
function Rail({ title, items, onSeeAll, onOpen, onStatusClick }: RailProps) {
  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={onSeeAll}
        className="-mx-1 mb-2 flex min-h-11 w-[calc(100%+0.5rem)] items-center justify-between gap-2 rounded-lg px-1 text-left active:bg-primary-dark/20"
      >
        <h2 className="text-lg font-semibold text-ink">
          {title} <span className="text-sm font-normal text-lavender">· {items.length}</span>
        </h2>
        <span className="flex items-center text-sm text-accent">
          Ver todo <ChevronRight size={16} />
        </span>
      </button>
      <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
        {items.slice(0, 15).map((item) => (
          <div key={item.id} className="w-28 shrink-0 snap-start sm:w-32">
            <MediaCoverCard item={item} onClick={onOpen} onStatusClick={onStatusClick} />
          </div>
        ))}
        <div className="shrink-0 basis-1" aria-hidden="true" />
      </div>
    </section>
  )
}

/**
 * Biblioteca de Pantalla, con diseño de app de streaming: lo que estás viendo
 * arriba con avance rápido (+1 episodio, "la vi") y una fila por estado. Los
 * atajos de la barra inferior (?estado=) y la búsqueda abren la cuadrícula
 * completa.
 */
export function ScreenLibrary() {
  const navigate = useNavigate()
  const { items, loading, error, updateItem } = useMedia()
  const { showToast, showError } = useToast()

  const screenItems = useMemo(
    () => items.filter((i) => (section.types as string[]).includes(i.media_type)),
    [items]
  )

  const [params, setParams] = useSearchParams()
  const typeParam = params.get('tipo') ?? ''
  const typeFilter: TypeFilter = (section.types as string[]).includes(typeParam)
    ? (typeParam as ScreenType)
    : 'todos'
  const statusParam = params.get('estado') ?? ''
  const statusFilter = (itemStatuses as string[]).includes(statusParam)
    ? (statusParam as ItemStatus)
    : null
  const search = params.get('q') ?? ''
  const [searchOpen, setSearchOpen] = useState(search !== '')

  function setParam(key: string, value: string | null, replace = true) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value == null || value === '') next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace }
    )
  }

  const typed = useMemo(
    () => (typeFilter === 'todos' ? screenItems : screenItems.filter((i) => i.media_type === typeFilter)),
    [screenItems, typeFilter]
  )

  const watching = useMemo(
    () => typed.filter((i) => i.status === 'in_progress').sort(byRecent),
    [typed]
  )
  const rails = useMemo(
    () =>
      RAILS.map((r) => ({
        ...r,
        items: typed
          .filter((i) => i.status === r.status)
          .sort(r.status === 'completed' ? byFinished : byRecent),
      })).filter((r) => r.items.length > 0),
    [typed]
  )

  /** Cuadrícula completa: un estado (atajo o "Ver todo") y/o una búsqueda. */
  const grid = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!statusFilter && !query) return null
    return typed
      .filter(
        (i) =>
          (!statusFilter || i.status === statusFilter) &&
          (!query ||
            i.title.toLowerCase().includes(query) ||
            (i.metadata.original_title ?? '').toLowerCase().includes(query))
      )
      .sort(statusFilter === 'completed' ? byFinished : byRecent)
  }, [typed, statusFilter, search])

  const open = (item: Item) => navigate(section.detailPath(item.id))

  // Cambio rápido de estado desde el póster.
  const [statusItem, setStatusItem] = useState<Item | null>(null)
  const closeStatusSheet = useCallback(() => setStatusItem(null), [])
  async function handleQuickStatus(status: ItemStatus) {
    const item = statusItem
    setStatusItem(null)
    if (!item || item.status === status) return
    haptic()
    try {
      await updateItem(item.id, statusChanges(item, status, todayISO()))
      showToast(`${item.title}: ${section.statusLabels[status]}`)
    } catch (err) {
      showError(err, 'No se pudo cambiar el estado')
    }
  }

  // Avance rápido desde "Seguir viendo" (misma lógica que el inicio).
  const { busyId, advance } = useQuickProgress()

  const isEmpty = !loading && !error && screenItems.length === 0
  const gridTitle = statusFilter
    ? (RAILS.find((r) => r.status === statusFilter)?.title ?? section.statusLabels[statusFilter])
    : 'Resultados'

  return (
    <PageContainer>
      <TrackerBar tracker="pantalla" />

      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold text-ink">Pantalla</h1>
          <p className="text-sm text-lavender">Películas, series y anime</p>
        </div>
        {!isEmpty && (
          <button
            type="button"
            onClick={() => {
              if (searchOpen) setParam('q', null)
              setSearchOpen((v) => !v)
            }}
            aria-label={searchOpen ? 'Cerrar búsqueda' : 'Buscar'}
            aria-pressed={searchOpen}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-primary-dark/30"
          >
            {searchOpen ? <X size={20} /> : <Search size={20} />}
          </button>
        )}
      </div>

      {searchOpen && (
        <input
          type="search"
          autoFocus
          enterKeyHint="search"
          value={search}
          onChange={(e) => setParam('q', e.target.value)}
          placeholder="Buscar por título..."
          aria-label="Buscar en Pantalla"
          className="mb-3 w-full rounded-xl bg-background-surface px-4 py-2.5 text-sm text-ink ring-1 ring-primary-dark/40 [&::-webkit-search-cancel-button]:hidden focus:outline-none focus:ring-2 focus:ring-accent md:max-w-sm"
        />
      )}

      {!isEmpty && (
        <div
          role="group"
          aria-label="Tipo"
          className="scrollbar-hide -mx-4 mb-4 flex gap-1 overflow-x-auto px-4"
        >
          {(['todos', ...section.types] as TypeFilter[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setParam('tipo', t === 'todos' ? null : t)}
              aria-pressed={typeFilter === t}
              className={`relative min-h-11 shrink-0 px-3 text-sm font-semibold transition-colors ${
                typeFilter === t
                  ? 'text-ink after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:rounded-full after:bg-accent'
                  : 'text-lavender'
              }`}
            >
              {t === 'todos' ? 'Todo' : mediaTypePlurals[t]}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mb-3 text-sm text-error">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <div className="flex gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-28" />
            ))}
          </div>
        </div>
      ) : isEmpty ? (
        <div className="mt-4 flex flex-col items-center rounded-3xl bg-background-surface px-6 py-10 text-center ring-1 ring-primary-dark/40">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">
            <section.Icon size={30} />
          </div>
          <h2 className="text-lg font-semibold text-ink">Nada en cartelera todavía</h2>
          <p className="mt-1 max-w-xs text-sm text-lavender">{section.emptyText}</p>
          <Link
            to={section.addPath}
            className="mt-6 flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-primary-darker"
          >
            <Search size={18} /> Buscar
          </Link>
        </div>
      ) : grid ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              {statusFilter && (
                <button
                  type="button"
                  onClick={() => setParam('estado', null, false)}
                  aria-label="Volver a Pantalla"
                  className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-accent active:bg-primary-dark/30"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <h2 className="truncate text-xl font-semibold text-ink">{gridTitle}</h2>
            </div>
            <span className="shrink-0 text-sm text-lavender">{grid.length}</span>
          </div>
          {grid.length === 0 ? (
            <p className="mt-8 text-center text-sm text-lavender">
              {search ? 'Nada coincide con la búsqueda.' : 'Nada por acá todavía.'}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
              {grid.map((item) => (
                <MediaCoverCard key={item.id} item={item} onClick={open} onStatusClick={setStatusItem} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <Stats items={typed} />

          {watching.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 text-lg font-semibold text-ink">Seguir viendo</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {watching.map((item) => (
                  <ContinueCard
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    onOpen={() => open(item)}
                    onAdvance={() => advance(item)}
                  />
                ))}
              </div>
            </section>
          )}

          {rails.map((r) => (
            <Rail
              key={r.status}
              title={r.title}
              items={r.items}
              onSeeAll={() => setParam('estado', r.status, false)}
              onOpen={open}
              onStatusClick={setStatusItem}
            />
          ))}

          {watching.length === 0 && rails.length === 0 && (
            <p className="mt-8 text-center text-sm text-lavender">
              No tienes {typeFilter === 'todos' ? 'nada' : mediaTypePlurals[typeFilter].toLowerCase()} por
              acá todavía.
            </p>
          )}
        </>
      )}

      <ItemStatusSheet
        open={statusItem != null}
        onClose={closeStatusSheet}
        value={statusItem?.status ?? 'planned'}
        onChange={handleQuickStatus}
        labels={section.statusLabels}
        section={section}
        title={statusItem?.title ?? 'Cambiar estado'}
      />
    </PageContainer>
  )
}
