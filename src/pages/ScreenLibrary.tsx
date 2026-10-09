import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Tv, X } from 'lucide-react'
import { useMedia } from '../contexts/MediaContext'
import { useToast } from '../contexts/ToastContext'
import { PageContainer } from '../components/PageContainer'
import { SectionTabs } from '../components/SectionTabs'
import { MediaCoverCard } from '../components/MediaCoverCard'
import { ItemStatusSheet } from '../components/ItemStatusSheet'
import { Chip } from '../components/Chip'
import { Skeleton } from '../components/Skeleton'
import { haptic } from '../lib/haptics'
import { todayISO } from '../lib/dates'
import {
  isScreenType,
  itemStatuses,
  screenStatusLabels,
  screenTypePlurals,
  screenTypes,
  statusChanges,
} from '../lib/media'
import type { Item, ItemStatus, ScreenType } from '../types/item'

type TypeFilter = ScreenType | 'todos'
type StatusFilter = ItemStatus | 'todos'

function EmptyScreen() {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl bg-background-surface px-6 py-10 text-center ring-1 ring-primary-dark/30">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-dark/30 text-accent">
        <Tv size={30} />
      </div>
      <h2 className="text-lg font-semibold text-ink">Nada por acá todavía</h2>
      <p className="mt-1 max-w-xs text-sm text-lavender">
        Agrega películas, series y anime para llevar lo que viste, lo que estás viendo y lo que
        tienes pendiente.
      </p>
      <Link
        to="/pantalla/agregar"
        className="mt-6 flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white"
      >
        <Search size={18} /> Buscar
      </Link>
    </div>
  )
}

/** Biblioteca de la sección Pantalla: películas, series y anime. */
export function ScreenLibrary() {
  const navigate = useNavigate()
  const { items, loading, error, updateItem } = useMedia()
  const { showToast, showError } = useToast()

  const screenItems = useMemo(() => items.filter((i) => isScreenType(i.media_type)), [items])

  // Filtros en la URL, como en la biblioteca de juegos.
  const [params, setParams] = useSearchParams()
  const typeParam = params.get('tipo') ?? ''
  const typeFilter: TypeFilter = isScreenType(typeParam) ? typeParam : 'todos'
  const statusParam = params.get('estado') ?? ''
  const statusFilter: StatusFilter = (itemStatuses as string[]).includes(statusParam)
    ? (statusParam as ItemStatus)
    : 'todos'
  const search = params.get('q') ?? ''

  function setParam(key: string, value: string, defaultValue: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === defaultValue) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true }
    )
  }

  const hasFilters = typeFilter !== 'todos' || statusFilter !== 'todos' || search !== ''

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return screenItems.filter(
      (i) =>
        (typeFilter === 'todos' || i.media_type === typeFilter) &&
        (statusFilter === 'todos' || i.status === statusFilter) &&
        (query === '' || i.title.toLowerCase().includes(query))
    )
  }, [screenItems, typeFilter, statusFilter, search])

  const [statusItem, setStatusItem] = useState<Item | null>(null)
  const closeStatusSheet = useCallback(() => setStatusItem(null), [])
  async function handleQuickStatus(status: ItemStatus) {
    const item = statusItem
    setStatusItem(null)
    if (!item || item.status === status) return
    haptic()
    try {
      await updateItem(item.id, statusChanges(item, status, todayISO()))
      showToast(`${item.title}: ${screenStatusLabels[status]}`)
    } catch (err) {
      showError(err, 'No se pudo cambiar el estado')
    }
  }

  const isEmpty = !loading && !error && screenItems.length === 0

  return (
    <PageContainer>
      <SectionTabs current="pantalla" />

      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Pantalla</h1>
        {!loading && screenItems.length > 0 && (
          <span className="text-sm text-lavender">
            {hasFilters ? `${filtered.length} de ${screenItems.length}` : screenItems.length}
          </span>
        )}
      </div>

      {isEmpty ? (
        <EmptyScreen />
      ) : (
        <>
          <div className="relative mb-4 md:max-w-xs">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lavender"
            />
            <input
              type="search"
              enterKeyHint="search"
              value={search}
              onChange={(e) => setParam('q', e.target.value, '')}
              placeholder="Buscar por título..."
              aria-label="Buscar por título"
              className="w-full rounded-xl bg-background-surface py-2.5 pl-9 pr-10 text-sm text-ink ring-1 ring-primary-dark/30 [&::-webkit-search-cancel-button]:hidden focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setParam('q', '', '')}
                aria-label="Borrar búsqueda"
                className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-lavender"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="scrollbar-hide -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 py-1.5">
            {(['todos', ...screenTypes] as TypeFilter[]).map((t) => (
              <Chip key={t} active={typeFilter === t} onClick={() => setParam('tipo', t, 'todos')}>
                {t === 'todos' ? 'Todo' : screenTypePlurals[t]}
              </Chip>
            ))}
          </div>
          <div className="scrollbar-hide -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 py-1.5">
            {(['todos', ...itemStatuses] as StatusFilter[]).map((s) => (
              <Chip
                key={s}
                active={statusFilter === s}
                onClick={() => setParam('estado', s, 'todos')}
              >
                {s === 'todos' ? 'Todos' : screenStatusLabels[s]}
              </Chip>
            ))}
            <div className="shrink-0 basis-2" aria-hidden="true" />
          </div>

          {error && <p className="mb-3 text-sm text-error">{error}</p>}

          {loading ? (
            <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[2/3] w-full" />
              ))}
            </div>
          ) : (
            <>
              {filtered.length === 0 && (
                <div className="mt-8 flex flex-col items-center gap-3 text-center">
                  <p className="text-sm text-lavender">Nada coincide con el filtro.</p>
                  <button
                    type="button"
                    onClick={() => setParams({}, { replace: true })}
                    className="min-h-11 rounded-full px-4 text-sm font-medium text-accent active:bg-primary-dark/20"
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
              <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
                {filtered.map((item) => (
                  <MediaCoverCard
                    key={item.id}
                    item={item}
                    onClick={(i) => navigate(`/pantalla/${i.id}`)}
                    onStatusClick={setStatusItem}
                  />
                ))}
              </div>
            </>
          )}

          <ItemStatusSheet
            open={statusItem != null}
            onClose={closeStatusSheet}
            value={statusItem?.status ?? 'planned'}
            onChange={handleQuickStatus}
            labels={screenStatusLabels}
            title={statusItem?.title ?? 'Cambiar estado'}
          />
        </>
      )}
    </PageContainer>
  )
}
