import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Library, Rows3, Search, X } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { PageContainer } from '../../components/PageContainer'
import { TrackerBar } from '../../components/TrackerBar'
import { Skeleton } from '../../components/Skeleton'
import { mediaSections } from '../../lib/media'
import { Bookcase, Shelf, ShelfUnit, type ShelfMode } from './Bookshelf'
import { buildShelves, findShelf, shelfParam } from './bookLists'
import type { Item } from '../../types/item'

const section = mediaSections.libros
const MODE_KEY = 'shelflife_books_shelf_mode'

function readMode(): ShelfMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'lomos' ? 'lomos' : 'portadas'
  } catch {
    return 'portadas'
  }
}

/** Franja de números del librero (como en Otium Library). */
function Stats({ books }: { books: Item[] }) {
  const read = books.filter((b) => b.status === 'completed').length
  const reading = books.filter((b) => b.status === 'in_progress').length
  const want = books.filter((b) => b.status === 'wishlist' || b.status === 'planned').length
  const rated = books.filter((b) => b.rating != null)
  const avg = rated.length ? rated.reduce((s, b) => s + (b.rating ?? 0), 0) / rated.length / 2 : null
  const pages = books.reduce(
    (s, b) => s + (b.status === 'completed' ? (b.progress_total ?? b.progress) : b.progress),
    0
  )

  const cells: { value: string; label: string; extra?: string }[] = [
    { value: String(books.length), label: 'Libros' },
    {
      value: String(read),
      label: 'Leídos',
      extra: books.length ? `${Math.round((read / books.length) * 100)}%` : undefined,
    },
    { value: String(reading), label: 'Leyendo' },
    { value: String(want), label: 'Por leer' },
    { value: avg != null ? avg.toFixed(1) : '—', label: 'Puntaje ★' },
    { value: pages.toLocaleString(), label: 'Páginas' },
  ]

  return (
    <div className="scrollbar-hide -mx-4 mb-4 flex overflow-x-auto px-4">
      <div className="flex divide-x divide-primary-dark/15 rounded-2xl bg-background-surface shadow-sm ring-1 ring-primary-dark/15">
        {cells.map((c) => (
          <div key={c.label} className="flex min-w-[5.5rem] flex-col items-center px-3 py-2.5">
            <p className="font-book flex items-baseline gap-1 text-xl font-bold text-accent">
              {c.value}
              {c.extra && (
                <span className="rounded-full bg-accent/10 px-1.5 font-sans text-[10px] font-semibold">
                  {c.extra}
                </span>
              )}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-lavender">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** El librero: la única vista de la biblioteca de libros. */
export function BooksLibrary() {
  const navigate = useNavigate()
  const { items, loading, error } = useMedia()
  const books = useMemo(() => items.filter((i) => i.media_type === 'book'), [items])

  const [params, setParams] = useSearchParams()
  const openShelfId = params.get(shelfParam)
  const search = params.get('q') ?? ''
  const [searchOpen, setSearchOpen] = useState(search !== '')

  function setParam(key: string, value: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value == null || value === '') next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: key === 'q' }
    )
  }

  const [mode, setMode] = useState<ShelfMode>(readMode)
  function changeMode(next: ShelfMode) {
    setMode(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      /* preferencia no persistida */
    }
  }

  const units = useMemo(() => buildShelves(books), [books])
  const openShelf = useMemo(
    () => (openShelfId ? findShelf(books, openShelfId) : null),
    [books, openShelfId]
  )
  const results = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return null
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(query) ||
        (b.metadata.authors ?? []).some((a) => a.toLowerCase().includes(query))
    )
  }, [books, search])

  const openBook = (item: Item) => navigate(section.detailPath(item.id))
  const isEmpty = !loading && !error && books.length === 0

  const modeToggle = (
    <div
      role="group"
      aria-label="Cómo se ven los libros"
      className="flex rounded-full bg-background-surface p-0.5 shadow-sm ring-1 ring-primary-dark/15"
    >
      {(
        [
          ['portadas', Library, 'Portadas'],
          ['lomos', Rows3, 'Lomos'],
        ] as const
      ).map(([m, Icon, label]) => (
        <button
          key={m}
          type="button"
          onClick={() => changeMode(m)}
          aria-pressed={mode === m}
          className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium ${
            mode === m ? 'bg-accent text-white' : 'text-lavender'
          }`}
        >
          <Icon size={15} />
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <PageContainer>
      <TrackerBar tracker="libros" />

      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold text-ink">Mi librero</h1>
          <p className="text-sm text-lavender">Tu colección de lecturas</p>
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
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-primary-dark/15"
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
          placeholder="Título o autor..."
          aria-label="Buscar en tu librero"
          className="mb-3 w-full rounded-xl bg-background-surface px-4 py-2.5 text-sm text-ink ring-1 ring-primary-dark/25 [&::-webkit-search-cancel-button]:hidden focus:outline-none focus:ring-2 focus:ring-primary md:max-w-sm"
        />
      )}

      {error && <p className="mb-3 text-sm text-error">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-3xl" />
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col gap-4">
          <ShelfUnit title="Tu librero está vacío">
            <Shelf
              id="vacio"
              category="Estado"
              name="Por leer"
              items={[]}
              mode={mode}
              onOpenBook={openBook}
              emptyText={section.emptyText}
            />
          </ShelfUnit>
          <Link
            to={section.addPath}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white"
          >
            <Search size={18} /> Buscar un libro
          </Link>
        </div>
      ) : results ? (
        <>
          <p className="mb-3 text-sm text-lavender">
            {results.length === 0
              ? 'Ningún libro coincide con la búsqueda.'
              : `${results.length} ${results.length === 1 ? 'libro' : 'libros'}`}
          </p>
          {results.length > 0 && <Bookcase items={results} mode={mode} onOpenBook={openBook} />}
        </>
      ) : openShelf ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? navigate(-1) : setParam(shelfParam, null))}
              className="-ml-2 flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/15"
            >
              <ArrowLeft size={16} /> Librero
            </button>
            {modeToggle}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-lavender">{openShelf.category}</p>
          <h2 className="mb-3 text-2xl font-bold text-ink">
            {openShelf.name}{' '}
            <span className="font-sans text-base font-normal text-lavender">· {openShelf.items.length}</span>
          </h2>
          {openShelf.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-background-surface p-8 text-center ring-1 ring-primary-dark/15">
              <BookOpen size={28} className="text-lavender" />
              <p className="text-sm text-lavender">Este estante está vacío.</p>
            </div>
          ) : (
            <Bookcase items={openShelf.items} mode={mode} onOpenBook={openBook} />
          )}
        </>
      ) : (
        <>
          <Stats books={books} />
          <div className="mb-4 flex justify-end">{modeToggle}</div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {units.map((unit) => (
              <ShelfUnit key={unit.title} title={unit.title}>
                {unit.shelves.map((shelf) => (
                  <Shelf
                    key={shelf.id}
                    id={shelf.id}
                    category={shelf.category}
                    name={shelf.name}
                    items={shelf.items}
                    mode={mode}
                    onOpenBook={openBook}
                    onOpenShelf={() => setParam(shelfParam, shelf.id)}
                  />
                ))}
              </ShelfUnit>
            ))}
          </div>
        </>
      )}
    </PageContainer>
  )
}
