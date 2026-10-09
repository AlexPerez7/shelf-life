import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  Check,
  ChevronRight,
  FileUp,
  Loader2,
  PenLine,
  ScanBarcode,
  Search,
  X,
} from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { useToast } from '../../contexts/ToastContext'
import { PageContainer } from '../../components/PageContainer'
import { GameThumb } from '../../components/GameThumb'
import { Skeleton } from '../../components/Skeleton'
import { BottomSheet } from '../../components/BottomSheet'
import { MediaForm } from '../../components/MediaForm'
import { useMediaSearch } from '../../hooks/useMediaSearch'
import { haptic } from '../../lib/haptics'
import { todayISO } from '../../lib/dates'
import { mediaSections, needsDetails, resultToItemWithStatus, withDetails } from '../../lib/media'
import { BOOK_FORMATS, readLastBookFormat, saveLastBookFormat } from '../../lib/formats'
import { FormatPicker } from '../../components/FormatPicker'
import { IsbnScanner } from './IsbnScanner'
import { canScanBarcodes } from '../../lib/barcode'
import type { Item, ItemStatus, ItemWrite, MediaSearchResult } from '../../types/item'

const section = mediaSections.libros

const resultKey = (r: Pick<MediaSearchResult, 'source' | 'external_id'>) => `${r.source}:${r.external_id}`

/** Estados con los que se agrega directo desde la búsqueda. */
const ADD_OPTIONS: { status: ItemStatus; label: string; Icon: typeof Bookmark }[] = [
  { status: 'wishlist', label: 'Quiero leer', Icon: Bookmark },
  { status: 'in_progress', label: 'Leyendo', Icon: BookOpen },
  { status: 'completed', label: 'Leído', Icon: BookOpenCheck },
]

/** "2019 · 320 págs." */
function resultFacts(r: MediaSearchResult) {
  return [r.release_date?.slice(0, 4), r.pages ? `${r.pages} págs.` : null].filter(Boolean).join(' · ')
}

/** Portada chica de un resultado; sin portada, el título impreso en una tapa lisa. */
function Cover({ result, className }: { result: MediaSearchResult; className: string }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[3px] bg-primary-dark/20 shadow-[0_3px_6px_rgba(0,0,0,0.25)] ${className}`}
    >
      <GameThumb
        size="poster"
        src={result.cover_url}
        alt=""
        className="h-full w-full object-cover"
        placeholderClassName="text-xl"
        icon={BookOpen}
      />
      {!result.cover_url && (
        <span className="font-book absolute inset-x-1 bottom-1 line-clamp-3 text-center text-[9px] font-semibold leading-tight text-ink">
          {result.title}
        </span>
      )}
    </div>
  )
}

/**
 * Alta de Libros: búsqueda por título, autor o ISBN (Google Books u Open
 * Library) en una lista como la de Openreads. Tocar un libro abre su ficha,
 * desde la que se agrega directo a "Quiero leer", "Leyendo" o "Leído", sin
 * salir de la búsqueda.
 */
export function BookAdd() {
  const navigate = useNavigate()
  const { items, addItem } = useMedia()
  const { showToast, showError } = useToast()

  const [query, setQuery] = useState('')
  const { active: hasQuery, results, error: searchError, searching } = useMediaSearch('book', query)

  // Ya agregados, por origen + id externo.
  const existing = useMemo(() => {
    const map = new Map<string, Item>()
    for (const i of items) if (i.source && i.external_id) map.set(`${i.source}:${i.external_id}`, i)
    return map
  }, [items])

  // Ficha: el resultado tocado, completado con su detalle en segundo plano.
  const [preview, setPreview] = useState<MediaSearchResult | null>(null)
  const [details, setDetails] = useState<Record<string, MediaSearchResult>>({})
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [adding, setAdding] = useState<ItemStatus | null>(null)
  // Formato con el que se agrega (el último usado, para no marcarlo cada vez).
  const [format, setFormat] = useState(readLastBookFormat)

  // Escanear el ISBN: el libro se busca por ese número y, como está en la
  // mano, el formato pasa a "Físico".
  const [scanSupported] = useState(canScanBarcodes)
  const [scanning, setScanning] = useState(false)
  const handleDetected = useCallback((isbn: string) => {
    setScanning(false)
    setQuery(isbn)
    setFormat('Físico')
  }, [])

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
      const created = await addItem({ ...resultToItemWithStatus(full, status, todayISO()), format: format || null })
      saveLastBookFormat(format)
      setPreview(null)
      showToast(`${created.title}: ${section.statusLabels[status]}`)
    } catch (err) {
      showError(err, 'No se pudo agregar')
    } finally {
      setAdding(null)
    }
  }

  const [manualOpen, setManualOpen] = useState(false)

  /** Alta manual: lo que no está en Google Books ni Open Library. */
  async function handleManualAdd(data: ItemWrite & Pick<Item, 'media_type' | 'title'>) {
    const today = todayISO()
    if (data.status === 'in_progress') data.date_started = today
    if (data.status === 'completed') data.date_finished = today
    const created = await addItem(data)
    showToast(`Agregaste ${created.title} a tu librero`)
    navigate(section.detailPath(created.id), { replace: true })
  }

  return (
    <PageContainer>
      <button
        onClick={() => navigate(section.libraryPath)}
        className="-ml-2 mb-1 flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/15"
      >
        <ArrowLeft size={16} /> Librero
      </button>
      <h1 className="text-3xl font-bold text-ink">Agregar libro</h1>
      <p className="mb-4 text-sm text-lavender">Busca por título, autor o ISBN</p>

      <div className="md:max-w-xl">
        <div className="mb-4 flex gap-2">
          <div className="relative min-w-0 flex-1">
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
              placeholder="Título, autor o ISBN..."
              aria-label="Buscar un libro"
              className="w-full rounded-xl bg-background-surface py-3 pl-9 pr-10 text-base text-ink shadow-sm ring-1 ring-primary-dark/25 [&::-webkit-search-cancel-button]:hidden focus:outline-none focus:ring-2 focus:ring-primary"
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
        {scanSupported && (
          <button
            type="button"
            onClick={() => setScanning(true)}
            aria-label="Escanear el código de barras"
            className="flex w-12 shrink-0 items-center justify-center rounded-xl bg-background-surface text-accent shadow-sm ring-1 ring-primary-dark/25 active:bg-primary-dark/10"
          >
            <ScanBarcode size={20} />
          </button>
        )}
        </div>
        {scanning && <IsbnScanner onDetected={handleDetected} onClose={() => setScanning(false)} />}

        {searchError && <p className="mb-3 rounded-xl bg-error/10 p-3 text-sm text-error">{searchError}</p>}

        {!hasQuery && (
          <div className="mt-8 flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
              <BookOpen size={26} />
            </div>
            <p className="font-book max-w-xs text-sm text-lavender">
              Busca un libro y tócalo para ver su ficha y sumarlo a tu librero.
            </p>
          </div>
        )}

        {hasQuery && searching && results.length === 0 && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {hasQuery && !searching && results.length === 0 && !searchError && (
          <p className="mb-3 mt-6 text-center text-sm text-lavender">Sin resultados.</p>
        )}

        {hasQuery && results.length > 0 && (
          <ul
            className={`divide-y divide-primary-dark/15 overflow-hidden rounded-2xl bg-background-surface shadow-sm ring-1 ring-primary-dark/15 transition-opacity ${
              searching ? 'opacity-60' : ''
            }`}
          >
            {results.map((r) => {
              const added = existing.get(resultKey(r))
              return (
                <li key={resultKey(r)}>
                  <button
                    type="button"
                    onClick={() => openPreview(r)}
                    className="flex w-full items-center gap-3 p-3 text-left active:bg-primary-dark/10"
                  >
                    <Cover result={r} className="h-20 w-14" />
                    <div className="min-w-0 flex-1">
                      <p className="font-book line-clamp-2 font-semibold leading-snug text-ink">{r.title}</p>
                      {r.authors?.length ? (
                        <p className="truncate text-sm text-ink/80">{r.authors.slice(0, 2).join(', ')}</p>
                      ) : null}
                      <p className="truncate text-xs text-lavender">{resultFacts(r)}</p>
                    </div>
                    {added ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent">
                        <Check size={12} /> {section.statusLabels[added.status]}
                      </span>
                    ) : (
                      <ChevronRight size={18} className="shrink-0 text-lavender" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-accent ring-1 ring-primary-dark/30 active:bg-primary-dark/10"
        >
          <PenLine size={16} />
          {hasQuery ? `Agregar “${query.trim()}” a mano` : 'Agregar a mano'}
        </button>
        <p className="mt-2 text-center text-xs text-lavender">
          Para lo que no aparece en la búsqueda: completas tú los datos.
        </p>

        <Link
          to={`${section.libraryPath}/importar`}
          className="mt-6 flex items-center gap-3 rounded-2xl bg-background-surface p-3.5 shadow-sm ring-1 ring-primary-dark/15 active:bg-primary-dark/10"
        >
          <FileUp size={20} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-book block font-semibold text-ink">¿Vienes de Goodreads o StoryGraph?</span>
            <span className="text-lavender">Importa toda tu biblioteca de una vez</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-lavender" />
        </Link>
      </div>

      <BottomSheet open={preview != null} onClose={() => setPreview(null)} title={shown?.title ?? 'Ficha'}>
        {shown && (
          <div>
            <div className="flex gap-4">
              <Cover result={shown} className="h-36 w-24" />
              <div className="min-w-0">
                {shown.authors?.length ? (
                  <p className="font-book font-semibold text-ink">{shown.authors.join(', ')}</p>
                ) : null}
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-lavender">
                  {resultFacts(shown)}
                  {loadingDetails && <Loader2 size={13} className="animate-spin" aria-label="Cargando ficha" />}
                </p>
                {shown.publisher && <p className="text-xs text-lavender">{shown.publisher}</p>}
                {shown.genres.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {shown.genres.slice(0, 4).map((g) => (
                      <span
                        key={g}
                        className="rounded-full bg-background px-2 py-0.5 text-[11px] text-lavender ring-1 ring-primary-dark/20"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {shown.summary && (
              <p className="font-book mt-4 line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-lavender">
                {shown.summary}
              </p>
            )}

            {shownExisting ? (
              <button
                type="button"
                onClick={() => navigate(section.detailPath(shownExisting.id))}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-background font-semibold text-accent ring-1 ring-primary-dark/25"
              >
                <Check size={18} /> En tu librero: {section.statusLabels[shownExisting.status]}
              </button>
            ) : (
              <>
                <div className="mt-5">
                  <span className="mb-1.5 block text-xs text-lavender">Formato</span>
                  <FormatPicker
                    value={format}
                    onChange={setFormat}
                    options={BOOK_FORMATS}
                    inactiveClassName="bg-background text-lavender ring-1 ring-primary-dark/25"
                  />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {ADD_OPTIONS.map(({ status, label, Icon }) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleAdd(status)}
                      disabled={adding != null}
                      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold transition-transform active:scale-95 disabled:opacity-60 ${
                        status === 'wishlist'
                          ? 'bg-primary text-white'
                          : 'bg-background text-ink ring-1 ring-primary-dark/25'
                      }`}
                    >
                      {adding === status ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={manualOpen} onClose={() => setManualOpen(false)} title="Agregar a mano">
        {manualOpen && (
          <MediaForm
            section={section}
            initialTitle={query.trim()}
            initialType="book"
            submitLabel="Agregar"
            onSubmit={handleManualAdd}
          />
        )}
      </BottomSheet>
    </PageContainer>
  )
}
