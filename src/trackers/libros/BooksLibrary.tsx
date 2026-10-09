import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BookOpen, LayoutGrid, List, Search, X } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { useToast } from '../../contexts/ToastContext'
import { PageContainer } from '../../components/PageContainer'
import { TrackerBar } from '../../components/TrackerBar'
import { MediaCoverCard } from '../../components/MediaCoverCard'
import { ItemStatusSheet } from '../../components/ItemStatusSheet'
import { GameThumb } from '../../components/GameThumb'
import { Skeleton } from '../../components/Skeleton'
import { haptic } from '../../lib/haptics'
import { formatDate, todayISO } from '../../lib/dates'
import { itemStatusColor, mediaSections, statusChanges } from '../../lib/media'
import { bookListParam, bookLists, isBookList, type BookList } from './bookLists'
import type { Item, ItemStatus } from '../../types/item'

const section = mediaSections.libros
const VIEW_KEY = 'shelflife_books_view'
type ViewMode = 'lista' | 'portadas'

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'portadas' ? 'portadas' : 'lista'
  } catch {
    return 'lista'
  }
}

/** Puntaje 1-10 como 5 estrellas (con medias), solo lectura. */
function MiniStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating / 2} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.max(0, Math.min(2, rating - i * 2)) * 50
        return (
          <span key={i} className="relative h-3.5 w-3.5">
            <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full fill-primary-dark/25">
              <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
            </svg>
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill}%` }}>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-[var(--color-star)]">
                <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
              </svg>
            </span>
          </span>
        )
      })}
    </div>
  )
}

function percentOf(item: Item) {
  return item.progress_total
    ? Math.min(100, Math.round((item.progress / item.progress_total) * 100))
    : null
}

/** Fila de libro, al estilo de Openreads: portada, datos y estado a la derecha. */
function BookRow({
  item,
  onOpen,
  onStatus,
}: {
  item: Item
  onOpen: () => void
  onStatus: () => void
}) {
  const percent = percentOf(item)
  const reading = item.status === 'in_progress' || item.status === 'paused'
  return (
    <li className="relative">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full gap-3 rounded-2xl bg-background-surface p-3 pr-4 text-left shadow-sm ring-1 ring-primary-dark/15 transition-transform active:scale-[0.99]"
      >
        <div className="h-28 w-[4.5rem] flex-shrink-0 overflow-hidden rounded-md shadow-md shadow-black/20">
          <GameThumb
            src={item.cover_url}
            alt=""
            className="h-full w-full object-cover"
            placeholderClassName="text-2xl"
            icon={BookOpen}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="font-book line-clamp-2 pr-20 text-[15px] font-semibold leading-snug text-ink">
            {item.title}
          </p>
          {item.metadata.authors?.length ? (
            <p className="truncate text-sm text-lavender">{item.metadata.authors.join(', ')}</p>
          ) : null}
          {item.release_date && (
            <p className="text-xs text-lavender/80">{item.release_date.slice(0, 4)}</p>
          )}
          <div className="mt-auto pt-1.5">
            {reading && percent != null ? (
              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-primary-dark/20">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1 text-xs text-lavender">
                  {percent}% · pág. {item.progress} de {item.progress_total}
                </p>
              </div>
            ) : item.rating ? (
              <MiniStars rating={item.rating} />
            ) : null}
          </div>
        </div>
        {item.status === 'completed' && item.date_finished && (
          <div className="absolute bottom-3 right-4 text-right">
            <p className="text-[11px] text-lavender">Leído</p>
            <p className="text-xs font-semibold tabular-nums text-ink">{formatDate(item.date_finished)}</p>
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onStatus}
        aria-label={`Estado: ${section.statusLabels[item.status]}. Cambiar`}
        className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold after:absolute after:-inset-2 after:content-[''] ${itemStatusColor(item.status, section)}`}
      >
        {section.statusLabels[item.status]}
      </button>
    </li>
  )
}

function sortFor(list: BookList, items: Item[]) {
  const by = (key: (i: Item) => string | null) =>
    [...items].sort((a, b) => (key(b) ?? '').localeCompare(key(a) ?? ''))
  if (list === 'leyendo') return by((i) => i.updated_at)
  if (list === 'leidos') return by((i) => i.date_finished ?? i.updated_at)
  return items // created_at desc, como llegan de la DB
}

/** Biblioteca del tracker de libros. */
export function BooksLibrary() {
  const navigate = useNavigate()
  const { items, loading, error, updateItem } = useMedia()
  const { showToast, showError } = useToast()
  const books = useMemo(() => items.filter((i) => i.media_type === 'book'), [items])

  const [params, setParams] = useSearchParams()
  const listParam = params.get(bookListParam)
  const list: BookList = isBookList(listParam) ? listParam : 'todos'
  const search = params.get('q') ?? ''
  const [searchOpen, setSearchOpen] = useState(search !== '')

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

  const [view, setView] = useState<ViewMode>(readView)
  function toggleView() {
    const next = view === 'lista' ? 'portadas' : 'lista'
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      /* preferencia no persistida */
    }
  }

  const counts = useMemo(() => {
    const c = {} as Record<BookList, number>
    for (const l of bookLists) {
      c[l.id] = l.statuses ? books.filter((b) => l.statuses!.includes(b.status)).length : books.length
    }
    return c
  }, [books])

  const shown = useMemo(() => {
    const statuses = bookLists.find((l) => l.id === list)?.statuses
    const query = search.trim().toLowerCase()
    const filtered = books.filter(
      (b) =>
        (!statuses || statuses.includes(b.status)) &&
        (query === '' ||
          b.title.toLowerCase().includes(query) ||
          (b.metadata.authors ?? []).some((a) => a.toLowerCase().includes(query)))
    )
    return sortFor(list, filtered)
  }, [books, list, search])

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

  const isEmpty = !loading && !error && books.length === 0

  return (
    <PageContainer>
      <TrackerBar tracker="libros" />

      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">Mis libros</h1>
        {!isEmpty && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                if (searchOpen) setParam('q', '', '')
                setSearchOpen((v) => !v)
              }}
              aria-label={searchOpen ? 'Cerrar búsqueda' : 'Buscar'}
              aria-pressed={searchOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-primary-dark/15"
            >
              {searchOpen ? <X size={20} /> : <Search size={20} />}
            </button>
            <button
              type="button"
              onClick={toggleView}
              aria-label={view === 'lista' ? 'Ver como portadas' : 'Ver como lista'}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-primary-dark/15"
            >
              {view === 'lista' ? <LayoutGrid size={20} /> : <List size={20} />}
            </button>
          </div>
        )}
      </div>

      {searchOpen && (
        <input
          type="search"
          autoFocus
          enterKeyHint="search"
          value={search}
          onChange={(e) => setParam('q', e.target.value, '')}
          placeholder="Título o autor..."
          aria-label="Buscar en tus libros"
          className="mb-3 w-full rounded-xl bg-background-surface px-4 py-2.5 text-sm text-ink ring-1 ring-primary-dark/25 [&::-webkit-search-cancel-button]:hidden focus:outline-none focus:ring-2 focus:ring-primary md:max-w-sm"
        />
      )}

      {isEmpty ? (
        <div className="mt-8 flex flex-col items-center rounded-3xl bg-background-surface px-6 py-12 text-center shadow-sm ring-1 ring-primary-dark/15">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
            <BookOpen size={30} />
          </div>
          <h2 className="text-xl font-semibold text-ink">Tu biblioteca está vacía</h2>
          <p className="mt-2 max-w-xs text-sm text-lavender">{section.emptyText}</p>
          <Link
            to={section.addPath}
            className="mt-6 flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white"
          >
            <Search size={18} /> Buscar un libro
          </Link>
        </div>
      ) : (
        <>
          {/* Pestañas subrayadas, como las listas de Openreads. */}
          <div
            role="tablist"
            aria-label="Listas"
            className="scrollbar-hide -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-primary-dark/20 px-4"
          >
            {bookLists.map((l) => {
              const active = l.id === list
              return (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setParam(bookListParam, l.id, 'todos')}
                  className={`relative flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-sm font-medium ${
                    active ? 'text-accent' : 'text-lavender'
                  }`}
                >
                  {l.label}
                  <span className="text-xs opacity-70">{counts[l.id]}</span>
                  {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
                </button>
              )
            })}
          </div>

          {error && <p className="mb-3 text-sm text-error">{error}</p>}

          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="mt-10 text-center text-sm text-lavender">
              {search ? 'Ningún libro coincide con la búsqueda.' : 'No hay libros en esta lista.'}
            </p>
          ) : view === 'lista' ? (
            <ul className="flex flex-col gap-3 md:grid md:grid-cols-2">
              {shown.map((item) => (
                <BookRow
                  key={item.id}
                  item={item}
                  onOpen={() => navigate(section.detailPath(item.id))}
                  onStatus={() => setStatusItem(item)}
                />
              ))}
            </ul>
          ) : (
            <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
              {shown.map((item) => (
                <MediaCoverCard
                  key={item.id}
                  item={item}
                  onClick={(i) => navigate(section.detailPath(i.id))}
                  onStatusClick={setStatusItem}
                />
              ))}
            </div>
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
        </>
      )}
    </PageContainer>
  )
}
