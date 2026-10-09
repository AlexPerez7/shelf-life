import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Gamepad2, Heart, LayoutGrid, List, Search, X } from 'lucide-react'
import { SiSteam } from 'react-icons/si'
import { useGames } from '../hooks/useGames'
import { GameCard } from '../components/GameCard'
import { GameCoverCard } from '../components/GameCoverCard'
import { StatusSheet } from '../components/StatusSheet'
import { useToast } from '../contexts/ToastContext'
import { haptic } from '../lib/haptics'
import { todayISO } from '../lib/dates'
import { plural } from '../lib/text'
import { GameCardGridSkeleton } from '../components/Skeleton'
import { PageContainer } from '../components/PageContainer'
import { SectionTabs } from '../components/SectionTabs'
import { Chip } from '../components/Chip'
import { parseTags } from '../lib/tags'
import { statusLabels, statuses } from '../lib/status'
import type { Game, GameStatus } from '../types/game'

type StatusFilter = GameStatus | 'todos'
type SortOption = 'recientes' | 'titulo' | 'horas' | 'puntaje'
type ViewMode = 'lista' | 'portadas'

const VIEW_KEY = 'shelflife_library_view'

function readViewPref(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'portadas' ? 'portadas' : 'lista'
  } catch {
    return 'lista'
  }
}

const statusFilters: StatusFilter[] = ['todos', ...statuses]

function statusFilterLabel(s: StatusFilter) {
  return s === 'todos' ? 'Todos' : statusLabels[s]
}

const sortLabels: Record<SortOption, string> = {
  recientes: 'Recientes',
  titulo: 'Título A-Z',
  horas: 'Más horas',
  puntaje: 'Mejor puntaje',
}

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
  labelFor,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
  labelFor: (v: T) => string
}) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-lavender">{label}</p>
      <div className="relative -mx-4">
        <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 py-1.5">
          {options.map((opt) => (
            <Chip key={opt} active={value === opt} onClick={() => onChange(opt)}>
              {labelFor(opt)}
            </Chip>
          ))}
          <div className="shrink-0 basis-2" aria-hidden="true" />
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-8"
          style={{
            background: 'linear-gradient(to left, var(--color-background, #14091f), transparent)',
          }}
        />
      </div>
    </div>
  )
}

function EmptyLibrary() {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl bg-background-surface px-6 py-10 text-center ring-1 ring-primary-dark/30">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-dark/30 text-accent">
        <Gamepad2 size={30} />
      </div>
      <h2 className="text-lg font-semibold text-ink">Tu biblioteca está vacía</h2>
      <p className="mt-1 max-w-xs text-sm text-lavender">
        Agrega tu primer juego buscándolo por nombre, o trae toda tu biblioteca de Steam de una vez.
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
        <Link
          to="/add"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white"
        >
          <Search size={18} /> Buscar un juego
        </Link>
        <Link
          to="/steam-import"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1b2838] font-medium text-white ring-1 ring-white/10"
        >
          <SiSteam size={18} /> Importar desde Steam
        </Link>
      </div>
    </div>
  )
}

export function Library() {
  const navigate = useNavigate()
  const { games, loading, error, updateGame } = useGames()
  const { showToast, showError } = useToast()

  const [view, setView] = useState<ViewMode>(readViewPref)
  function changeView(next: ViewMode) {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      /* preferencia no persistida */
    }
  }

  // Cambio rápido de estado desde la tarjeta.
  const [statusGame, setStatusGame] = useState<Game | null>(null)
  const closeStatusSheet = useCallback(() => setStatusGame(null), [])
  async function handleQuickStatus(newStatus: GameStatus) {
    const game = statusGame
    setStatusGame(null)
    if (!game || game.status === newStatus) return
    haptic()
    const changes: Partial<Game> = { status: newStatus }
    if (newStatus === 'jugando' && !game.date_started) changes.date_started = todayISO()
    if (newStatus === 'completado' && !game.date_finished) changes.date_finished = todayISO()
    try {
      await updateGame(game.id, changes)
      showToast(`${game.title}: ${statusLabels[newStatus]}`)
    } catch (err) {
      showError(err, 'No se pudo cambiar el estado')
    }
  }

  // Los filtros viven en la URL: sobreviven a entrar a un juego y volver,
  // y el Dashboard puede enlazar directo a "completados", por ejemplo.
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('estado')
  const statusFilter: StatusFilter =
    statusParam && (statuses as string[]).includes(statusParam) ? (statusParam as GameStatus) : 'todos'
  const platformFilter = params.get('plataforma') ?? 'todas'
  const search = params.get('q') ?? ''
  const onlyFavorites = params.get('fav') === '1'
  const sortParam = params.get('orden') as SortOption | null
  const sortBy: SortOption = sortParam && sortParam in sortLabels ? sortParam : 'recientes'

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

  const hasFilters =
    statusFilter !== 'todos' || platformFilter !== 'todas' || search !== '' || onlyFavorites

  const platforms = useMemo(() => {
    const set = new Set(games.flatMap((g) => parseTags(g.platform)))
    return ['todas', ...Array.from(set)]
  }, [games])

  // Con bibliotecas grandes (importadas de Steam) filtrar y ordenar en cada
  // render se nota al escribir en el buscador: se memoiza.
  const sorted = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = games.filter((g) => {
      const matchesStatus = statusFilter === 'todos' || g.status === statusFilter
      const matchesPlatform =
        platformFilter === 'todas' || parseTags(g.platform).includes(platformFilter)
      const matchesSearch = query === '' || g.title.toLowerCase().includes(query)
      const matchesFavorite = !onlyFavorites || g.is_favorite
      return matchesStatus && matchesPlatform && matchesSearch && matchesFavorite
    })

    // 'recientes' respeta el orden en que llegan de la DB (created_at desc).
    if (sortBy === 'recientes') return filtered
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'titulo':
          return a.title.localeCompare(b.title)
        case 'horas':
          return b.hours_played - a.hours_played
        default:
          return (b.rating ?? 0) - (a.rating ?? 0)
      }
    })
  }, [games, statusFilter, platformFilter, search, sortBy, onlyFavorites])

  const isEmpty = !loading && !error && games.length === 0

  return (
    <PageContainer>
      <SectionTabs current="juegos" />

      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Juegos</h1>
        {!loading && games.length > 0 && (
          <span className="text-sm text-lavender">
            {hasFilters ? `${sorted.length} de ${games.length}` : plural(games.length, 'juego')}
          </span>
        )}
      </div>

      {isEmpty ? (
        <EmptyLibrary />
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

          <div className="mb-3 flex items-center justify-between gap-2">
            <Chip
              active={onlyFavorites}
              onClick={() => setParam('fav', onlyFavorites ? '0' : '1', '0')}
            >
              <Heart
                size={14}
                className="-ml-0.5 mr-1.5"
                fill={onlyFavorites ? 'currentColor' : 'none'}
              />
              Favoritos
            </Chip>
            <div
              role="group"
              aria-label="Vista"
              className="flex rounded-full bg-background-surface p-0.5 ring-1 ring-primary-dark/30"
            >
              {(
                [
                  ['lista', List, 'Ver como lista'],
                  ['portadas', LayoutGrid, 'Ver como portadas'],
                ] as const
              ).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => changeView(mode)}
                  aria-label={label}
                  aria-pressed={view === mode}
                  className={`flex h-10 w-11 items-center justify-center rounded-full ${
                    view === mode ? 'bg-accent text-primary-darker' : 'text-lavender'
                  }`}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>

          <ChipRow
            label="Estado"
            options={statusFilters}
            value={statusFilter}
            onChange={(v) => setParam('estado', v, 'todos')}
            labelFor={statusFilterLabel}
          />

          {platforms.length > 2 && (
            <ChipRow
              label="Plataforma"
              options={platforms}
              value={platformFilter}
              onChange={(v) => setParam('plataforma', v, 'todas')}
              labelFor={(p) => (p === 'todas' ? 'Todas' : p)}
            />
          )}

          <ChipRow
            label="Ordenar"
            options={Object.keys(sortLabels) as SortOption[]}
            value={sortBy}
            onChange={(v) => setParam('orden', v, 'recientes')}
            labelFor={(s) => sortLabels[s]}
          />

          {error && <p className="mb-3 text-sm text-error">{error}</p>}

          {loading ? (
            <GameCardGridSkeleton />
          ) : (
            <>
              {sorted.length === 0 && (
                <div className="mt-8 flex flex-col items-center gap-3 text-center">
                  <p className="text-sm text-lavender">No hay juegos que coincidan con el filtro.</p>
                  {hasFilters && (
                    <button
                      type="button"
                      onClick={() => setParams({}, { replace: true })}
                      className="min-h-11 rounded-full px-4 text-sm font-medium text-accent active:bg-primary-dark/20"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              )}

              {view === 'portadas' ? (
                <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
                  {sorted.map((game) => (
                    <GameCoverCard
                      key={game.id}
                      game={game}
                      onClick={(g) => navigate(`/game/${g.id}`)}
                      onStatusClick={setStatusGame}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                  {sorted.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onClick={(g) => navigate(`/game/${g.id}`)}
                      onStatusClick={setStatusGame}
                    />
                  ))}
                </div>
              )}

              <StatusSheet
                open={statusGame != null}
                onClose={closeStatusSheet}
                value={statusGame?.status ?? 'pendiente'}
                onChange={handleQuickStatus}
                title={statusGame?.title ?? 'Cambiar estado'}
              />
            </>
          )}
        </>
      )}
    </PageContainer>
  )
}
