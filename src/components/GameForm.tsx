import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { igdbResultToNewGame, searchGames } from '../lib/igdb'
import { PlatformPicker } from './PlatformPicker'
import { StatusPicker } from './StatusPicker'
import { TagList } from './TagList'
import { unixToYear, yearToUnix } from '../lib/dates'
import type { GameStatus, IgdbSearchResult, NewGame } from '../types/game'

/** Espera tras la última tecla antes de consultar IGDB. */
const SEARCH_DEBOUNCE_MS = 350
const MIN_QUERY_LENGTH = 2

const emptyForm: NewGame = {
  title: '',
  platform: '',
  status: 'pendiente',
  genre: '',
  cover_url: '',
  igdb_id: undefined,
  summary: '',
  first_release_date: undefined,
}

interface GameFormProps {
  onSubmit: (game: NewGame) => Promise<void>
  existingIgdbIds?: Set<number>
}

export function GameForm({ onSubmit, existingIgdbIds }: GameFormProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<IgdbSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<NewGame>(emptyForm)
  // El año se edita como texto; se traduce a first_release_date al escribir.
  const [yearText, setYearText] = useState('')
  const [searched, setSearched] = useState(false)
  // Id de la última búsqueda lanzada: descarta respuestas que llegan tarde
  // (una búsqueda vieja no debe pisar los resultados de una más nueva).
  const searchSeq = useRef(0)

  // Búsqueda mientras se escribe, con debounce.
  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_QUERY_LENGTH) {
      searchSeq.current++
      setResults([])
      setSearching(false)
      setSearched(false)
      return
    }
    const seq = ++searchSeq.current
    const timer = setTimeout(async () => {
      setSearching(true)
      setError(null)
      try {
        const data = await searchGames(q)
        if (seq === searchSeq.current) {
          setResults(data)
          setSearched(true)
        }
      } catch (err) {
        if (seq === searchSeq.current) {
          setError(err instanceof Error ? err.message : 'Error buscando en IGDB')
        }
      } finally {
        if (seq === searchSeq.current) setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  function applyResult(result: IgdbSearchResult) {
    const next = igdbResultToNewGame(result)
    setForm((prev) => ({ ...prev, ...next }))
    setYearText(unixToYear(next.first_release_date))
    setQuery('')
    // Cerrar el teclado para que se vea la ficha elegida.
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit(form)
      setForm(emptyForm)
      setYearText('')
      setQuery('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const owned = form.igdb_id != null && existingIgdbIds?.has(form.igdb_id)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-lavender">
          Buscar en IGDB
        </label>
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lavender"
          />
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter no debe enviar el formulario: la búsqueda ya es automática.
              if (e.key === 'Enter') e.preventDefault()
            }}
            placeholder="Escribe el nombre del juego..."
            aria-label="Buscar en IGDB"
            className="w-full rounded-xl bg-background-surface py-3 pl-10 pr-11 text-ink ring-1 ring-primary-dark/30 [&::-webkit-search-cancel-button]:hidden focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searching ? (
            <Loader2
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-lavender"
            />
          ) : (
            query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Borrar búsqueda"
                className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-lavender"
              >
                <X size={18} />
              </button>
            )
          )}
        </div>

        {searched && !searching && results.length === 0 && (
          <p className="mt-2 text-sm text-lavender">
            Sin resultados en IGDB. Puedes cargarlo a mano con los campos de abajo.
          </p>
        )}

        {results.length > 0 && (
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-lg bg-background-surface p-2 ring-1 ring-primary-dark/30">
            {results.map((r) => {
              const resultOwned = existingIgdbIds?.has(r.id)
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => applyResult(r)}
                    className="flex min-h-16 w-full items-center gap-3 rounded-lg p-2 text-left text-sm active:bg-primary-dark/20"
                  >
                    <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-primary-dark/20">
                      {r.cover_url && (
                        <img
                          src={r.cover_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{r.name}</p>
                      {r.first_release_date && (
                        <p className="text-xs text-lavender">
                          {new Date(r.first_release_date * 1000).getFullYear()}
                        </p>
                      )}
                    </div>
                    {resultOwned && (
                      <span className="flex-shrink-0 rounded-full bg-primary-dark/20 px-2 py-0.5 text-xs text-accent">
                        ya en tu biblioteca
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {form.cover_url && (
        <div className="flex gap-3 rounded-lg bg-background-surface p-3 ring-1 ring-primary-dark/30">
          <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded bg-primary-dark/20">
            <img
              src={form.cover_url}
              alt={form.title}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{form.title}</p>
            {form.first_release_date && (
              <p className="text-sm text-lavender">
                {new Date(form.first_release_date * 1000).getFullYear()}
              </p>
            )}
            <div className="mt-1.5">
              <TagList value={form.genre} />
            </div>
            {owned && (
              <p className="mt-1.5 text-xs text-warning">
                Ya está en tu biblioteca. Puedes agregarlo igual si quieres otra copia.
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-lavender">Título *</label>
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full rounded-xl bg-background-surface px-3 py-2.5 text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-lavender">Portada (URL)</label>
          <input
            type="url"
            inputMode="url"
            value={form.cover_url ?? ''}
            onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
            placeholder="https://..."
            className="w-full rounded-xl bg-background-surface px-3 py-2.5 text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-lavender">Año</label>
          <input
            inputMode="numeric"
            maxLength={4}
            value={yearText}
            onChange={(e) => {
              setYearText(e.target.value)
              setForm({ ...form, first_release_date: yearToUnix(e.target.value) })
            }}
            placeholder="2024"
            className="w-full rounded-xl bg-background-surface px-3 py-2.5 text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-lavender">
          Plataforma(s)
        </label>
        <PlatformPicker
          value={form.platform}
          onChange={(platform) => setForm({ ...form, platform })}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-lavender">Estado</label>
        <StatusPicker
          value={form.status ?? 'pendiente'}
          onChange={(status: GameStatus) => setForm({ ...form, status })}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-lavender">Género</label>
        <input
          value={form.genre ?? ''}
          onChange={(e) => setForm({ ...form, genre: e.target.value })}
          placeholder="Separa varios con coma"
          className="w-full rounded-xl bg-background-surface px-3 py-2.5 text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={saving || !form.title.trim()}
        className="min-h-12 rounded-xl bg-primary font-semibold text-white disabled:opacity-40"
      >
        {saving ? 'Guardando...' : 'Guardar juego'}
      </button>
    </form>
  )
}
