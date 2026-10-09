import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Plus, Search, X } from 'lucide-react'
import { useMedia } from '../contexts/MediaContext'
import { useToast } from '../contexts/ToastContext'
import { PageContainer } from '../components/PageContainer'
import { GameThumb } from '../components/GameThumb'
import { Skeleton } from '../components/Skeleton'
import {
  getMediaDetails,
  hasEpisodes,
  isScreenType,
  resultToItem,
  screenTypeIcons,
  screenTypeLabels,
  screenTypes,
  searchMedia,
} from '../lib/media'
import type { MediaSearchResult, ScreenType } from '../types/item'

const SEARCH_DELAY_MS = 350

export function AddMedia() {
  const navigate = useNavigate()
  const { items, addItem } = useMedia()
  const { showToast, showError } = useToast()

  const [params, setParams] = useSearchParams()
  const typeParam = params.get('tipo') ?? ''
  const type: ScreenType = isScreenType(typeParam) ? typeParam : 'movie'
  function setType(next: ScreenType) {
    setParams({ tipo: next }, { replace: true })
  }

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MediaSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)

  // Búsqueda con debounce; una respuesta vieja no pisa a una más nueva.
  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) {
      setResults([])
      setSearchError(null)
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(() => {
      searchMedia(type, text)
        .then((r) => {
          if (cancelled) return
          setResults(r)
          setSearchError(null)
        })
        .catch((err) => {
          if (cancelled) return
          setResults([])
          setSearchError(err instanceof Error ? err.message : 'No se pudo buscar')
        })
        .finally(() => !cancelled && setSearching(false))
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, type])

  // Ya agregados, por origen + id externo.
  const existing = useMemo(() => {
    const map = new Map<string, string>()
    for (const i of items) if (i.source && i.external_id) map.set(`${i.source}:${i.external_id}`, i.id)
    return map
  }, [items])

  async function handleAdd(result: MediaSearchResult) {
    setAdding(result.external_id)
    try {
      // El detalle trae duración y episodios; si falla se agrega igual.
      let full = result
      if (result.source === 'tmdb') {
        full = await getMediaDetails(result.media_type, result.external_id).catch(() => result)
      }
      const created = await addItem(resultToItem(full))
      showToast(`Agregaste ${created.title} a tu biblioteca`)
      navigate(`/pantalla/${created.id}`, { replace: true })
    } catch (err) {
      showError(err, 'No se pudo agregar')
      setAdding(null)
    }
  }

  async function handleManualAdd() {
    const title = query.trim()
    if (!title) return
    setAdding('manual')
    try {
      const created = await addItem({ media_type: type, title, status: 'planned' })
      navigate(`/pantalla/${created.id}`, { replace: true })
    } catch (err) {
      showError(err, 'No se pudo agregar')
      setAdding(null)
    }
  }

  const TypeIcon = screenTypeIcons[type]

  return (
    <PageContainer>
      <button
        onClick={() => navigate('/pantalla')}
        className="-ml-2 mb-2 flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/20"
      >
        <ArrowLeft size={16} /> Pantalla
      </button>
      <h1 className="mb-4 text-xl font-semibold">Agregar</h1>

      <div className="md:mx-auto md:max-w-md">
        <div
          role="group"
          aria-label="Tipo"
          className="mb-3 flex rounded-full bg-background-surface p-1 ring-1 ring-primary-dark/30"
        >
          {screenTypes.map((t) => {
            const Icon = screenTypeIcons[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={t === type}
                className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-medium ${
                  t === type ? 'bg-accent text-primary-darker' : 'text-lavender'
                }`}
              >
                <Icon size={16} />
                {screenTypeLabels[t]}
              </button>
            )
          })}
        </div>

        <div className="relative mb-4">
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
            placeholder={`Buscar ${screenTypeLabels[type].toLowerCase()}...`}
            aria-label="Buscar por título"
            className="w-full rounded-xl bg-background-surface py-3 pl-9 pr-10 text-base text-ink ring-1 ring-primary-dark/30 [&::-webkit-search-cancel-button]:hidden focus:outline-none focus:ring-2 focus:ring-primary"
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

        {searchError && (
          <p className="mb-3 rounded-xl bg-error/10 p-3 text-sm text-error">{searchError}</p>
        )}

        {searching && results.length === 0 && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && !searchError && (
          <p className="mb-3 text-center text-sm text-lavender">Sin resultados.</p>
        )}

        <ul className="flex flex-col gap-2">
          {results.map((r) => {
            const existingId = existing.get(`${r.source}:${r.external_id}`)
            const year = r.release_date?.slice(0, 4)
            return (
              <li
                key={`${r.source}:${r.external_id}`}
                className="flex items-center gap-3 rounded-xl bg-background-surface p-2.5 ring-1 ring-primary-dark/30"
              >
                <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-md">
                  <GameThumb
                    src={r.cover_url}
                    alt=""
                    className="h-full w-full object-cover"
                    icon={screenTypeIcons[r.media_type]}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-ink">{r.title}</p>
                  <p className="text-xs text-lavender">
                    {[year, hasEpisodes(r.media_type) && r.episodes ? `${r.episodes} ep.` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {r.genres.length > 0 && (
                    <p className="truncate text-xs text-lavender/70">{r.genres.slice(0, 3).join(', ')}</p>
                  )}
                </div>
                {existingId ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/pantalla/${existingId}`)}
                    aria-label={`${r.title}: ya está en tu biblioteca`}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-dark/30 text-accent"
                  >
                    <Check size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAdd(r)}
                    disabled={adding != null}
                    aria-label={`Agregar ${r.title}`}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-50"
                  >
                    {adding === r.external_id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Plus size={18} />
                    )}
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {query.trim().length >= 2 && !searching && (
          <button
            type="button"
            onClick={handleManualAdd}
            disabled={adding != null}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-accent ring-1 ring-primary-dark/40 active:bg-primary-dark/20 disabled:opacity-50"
          >
            <TypeIcon size={16} />
            Agregar “{query.trim()}” a mano
          </button>
        )}
      </div>
    </PageContainer>
  )
}
