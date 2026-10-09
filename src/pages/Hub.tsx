import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, ChevronRight, ClipboardList, Play, Plus, Square } from 'lucide-react'
import { useGames } from '../hooks/useGames'
import { useLists } from '../hooks/useLists'
import { useMedia } from '../contexts/MediaContext'
import { useToast } from '../contexts/ToastContext'
import { formatElapsed, useNow, useSessionTimer } from '../contexts/SessionTimerContext'
import { useActivity } from '../hooks/useActivity'
import { useQuickProgress } from '../hooks/useQuickProgress'
import { PageContainer } from '../components/PageContainer'
import { GameThumb } from '../components/GameThumb'
import { BottomSheet } from '../components/BottomSheet'
import { Skeleton } from '../components/Skeleton'
import { asset } from '../lib/appUrl'
import { haptic } from '../lib/haptics'
import { parseDate } from '../lib/dates'
import { formatMinutes, mediaSections, mediaTypeIcons, mediaTypeLabels, progressKind } from '../lib/media'
import { ensureSession, supabase } from '../lib/supabaseClient'
import { gamesPaths } from '../trackers/juegos/paths'
import { listPaths } from '../lib/listPaths'
import { trackers, trackerIds, type TrackerId } from '../trackers/trackers'
import type { Game } from '../types/game'
import type { Item, MediaType, NonGameType } from '../types/item'

const ALL_TYPES: MediaType[] = ['game', 'movie', 'series', 'anime', 'book']
/** Cuántos en curso se muestran en el inicio. */
const NOW_LIMIT = 6

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 13) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

/** Algo en curso, de cualquier tracker. */
type NowEntry =
  | { kind: 'game'; tracker: 'juegos'; game: Game; updated: string }
  | { kind: 'media'; tracker: 'pantalla' | 'libros'; item: Item; updated: string }

/** Números de los últimos 7 días, de los tres trackers. */
function WeekStrip({ typeOf }: { typeOf: Map<string, MediaType> }) {
  const activity = useActivity(ALL_TYPES, 1)
  // Desde hace 7 días, fijado al abrir el inicio.
  const [since] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000)

  const week = useMemo(() => {
    if (!activity) return null
    let gameMinutes = 0
    let episodes = 0
    let movies = 0
    let pages = 0
    for (const r of activity) {
      if (parseDate(r.occurred_at).getTime() < since) continue
      const type = typeOf.get(r.item_id)
      if (type === 'game') gameMinutes += r.duration_minutes ?? 0
      else if (type === 'movie') movies++
      else if (type === 'book') pages += Math.max(0, r.progress_delta ?? 0)
      else if (type) episodes += Math.max(0, r.progress_delta ?? 0)
    }
    return [
      gameMinutes > 0 && { tracker: 'juegos' as const, value: formatMinutes(gameMinutes), label: 'jugando' },
      episodes > 0 && { tracker: 'pantalla' as const, value: String(episodes), label: episodes === 1 ? 'episodio' : 'episodios' },
      movies > 0 && { tracker: 'pantalla' as const, value: String(movies), label: movies === 1 ? 'película' : 'películas' },
      pages > 0 && { tracker: 'libros' as const, value: pages.toLocaleString('es'), label: pages === 1 ? 'página' : 'páginas' },
    ].filter(Boolean) as { tracker: TrackerId; value: string; label: string }[]
  }, [activity, typeOf, since])

  if (week == null) return <Skeleton className="mb-6 h-[4.5rem] w-full rounded-2xl" />
  if (week.length === 0) return null

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-lavender">Esta semana</h2>
      <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4">
        {week.map((c) => {
          const Icon = trackers[c.tracker].Icon
          return (
            <div
              key={c.label}
              data-tracker={c.tracker}
              className="flex min-w-[7.5rem] shrink-0 items-center gap-2.5 rounded-2xl bg-background-surface px-3 py-2.5 ring-1 ring-primary-dark/30"
            >
              <Icon size={18} className="shrink-0 text-accent" />
              <div>
                <p className="text-lg font-bold leading-tight tabular-nums text-ink">{c.value}</p>
                <p className="text-xs text-lavender">{c.label}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

interface NowCardProps {
  tracker: TrackerId
  to: string
  cover: string | null
  icon: typeof Play
  kicker: string
  title: string
  progress: string
  pct: number | null
  action: React.ReactNode
}

/** Tarjeta de "En curso": portada, avance y una acción rápida, con el acento de su tracker. */
function NowCard({ tracker, to, cover, icon, kicker, title, progress, pct, action }: NowCardProps) {
  return (
    <li data-tracker={tracker} className="flex items-center gap-3 rounded-2xl bg-background-surface p-2.5 ring-1 ring-primary-dark/30">
      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-80">
        <div className="h-[4.5rem] w-12 shrink-0 overflow-hidden rounded-lg bg-primary-dark/20">
          <GameThumb src={cover} alt="" className="h-full w-full object-cover" placeholderClassName="text-xl" icon={icon} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">{kicker}</p>
          <p className="truncate font-semibold text-ink">{title}</p>
          <p className="truncate text-xs text-lavender">{progress}</p>
          {pct != null && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-primary-dark/30">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      </Link>
      <div className="shrink-0">{action}</div>
    </li>
  )
}

const actionClass =
  'flex min-h-11 items-center gap-1 rounded-full bg-accent px-3.5 text-sm font-semibold text-background transition-transform active:scale-95 disabled:opacity-50'

/** Hoja para anotar la página de un libro sin entrar a su ficha. */
function PageSheet({
  book,
  busy,
  onClose,
  onSave,
}: {
  book: Item | null
  busy: boolean
  onClose: () => void
  onSave: (page: number, minutes: number | null) => void
}) {
  return (
    <BottomSheet open={book != null} onClose={onClose} title={book?.title ?? 'Página'}>
      {book && <PageForm key={book.id} book={book} busy={busy} onSave={onSave} />}
    </BottomSheet>
  )
}

function PageForm({ book, busy, onSave }: { book: Item; busy: boolean; onSave: (page: number, minutes: number | null) => void }) {
  const [page, setPage] = useState(String(book.progress || ''))
  const [minutes, setMinutes] = useState('')
  const total = book.progress_total
  const n = Number(page)
  const valid = page !== '' && Number.isInteger(n) && n >= 0 && (total == null || n <= total) && n !== book.progress
  const inputClass =
    'w-full rounded-xl bg-background px-3 py-2.5 text-ink ring-1 ring-primary-dark/40 focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        const m = Number(minutes)
        onSave(n, Number.isInteger(m) && m > 0 ? m : null)
      }}
      data-tracker="libros"
    >
      <p className="mb-3 text-sm text-lavender">
        Vas en la página {book.progress}
        {total ? ` de ${total}` : ''}.
      </p>
      <div className="flex gap-2">
        <label className="block flex-1">
          <span className="mb-1 block text-xs text-lavender">Voy en la página</span>
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            min={0}
            max={total ?? undefined}
            value={page}
            onChange={(e) => setPage(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block w-28">
          <span className="mb-1 block text-xs text-lavender">Minutos</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="opc."
            className={inputClass}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={!valid || busy}
        className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-background disabled:opacity-50"
      >
        Guardar
      </button>
    </form>
  )
}

/** Tarjeta de cada tracker: entrar y su resumen. */
function TrackerCard({ id, line }: { id: TrackerId; line: string }) {
  const { label, Icon, base } = trackers[id]
  return (
    <Link
      to={base}
      data-tracker={id}
      className="flex items-center gap-3 rounded-2xl bg-background-surface p-3 ring-1 ring-primary-dark/30 active:bg-primary-dark/10"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
        <Icon size={24} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-ink">{label}</h3>
        <p className="truncate text-sm text-lavender">{line}</p>
      </div>
      <ChevronRight size={20} className="text-accent" />
    </Link>
  )
}

/**
 * Inicio de Shelf Life: lo que está en curso en los tres trackers, con avance
 * rápido (jugar, +1 episodio, página), los números de la semana y la entrada
 * a cada tracker.
 */
export function Hub() {
  const { games, loading: loadingGames, refreshGame } = useGames()
  const { items, loading: loadingMedia } = useMedia()
  const { lists } = useLists()
  const { showToast, showError } = useToast()
  const sessionTimer = useSessionTimer()
  const timer = sessionTimer.timer
  const now = useNow(timer != null)
  const { busyId, advance, setPage } = useQuickProgress()
  const [pageBook, setPageBook] = useState<Item | null>(null)

  const loading = loadingGames || loadingMedia

  const typeOf = useMemo(() => {
    const map = new Map<string, MediaType>()
    for (const g of games) map.set(g.id, 'game')
    for (const i of items) map.set(i.id, i.media_type)
    return map
  }, [games, items])

  const nowEntries = useMemo(() => {
    const entries: NowEntry[] = [
      ...games
        .filter((g) => g.status === 'jugando')
        .map((g) => ({ kind: 'game' as const, tracker: 'juegos' as const, game: g, updated: g.updated_at })),
      ...items
        .filter((i) => i.status === 'in_progress')
        .map((i) => ({
          kind: 'media' as const,
          tracker: i.media_type === 'book' ? ('libros' as const) : ('pantalla' as const),
          item: i,
          updated: i.updated_at,
        })),
    ]
    // El juego con el cronómetro corriendo, siempre primero.
    return entries
      .sort((a, b) => {
        const aTimer = a.kind === 'game' && a.game.id === timer?.gameId ? 1 : 0
        const bTimer = b.kind === 'game' && b.game.id === timer?.gameId ? 1 : 0
        return bTimer - aTimer || (b.updated ?? '').localeCompare(a.updated ?? '')
      })
      .slice(0, NOW_LIMIT)
  }, [games, items, timer?.gameId])

  const lines = useMemo(() => {
    const books = items.filter((i) => i.media_type === 'book')
    const screen = items.filter((i) => i.media_type !== 'book')
    const line = (total: number, active: number, activeLabel: string, tagline: string) =>
      total === 0 ? tagline : `${total} en total${active ? ` · ${active} ${activeLabel}` : ''}`
    return {
      juegos: line(games.length, games.filter((g) => g.status === 'jugando').length, 'jugando', trackers.juegos.tagline),
      pantalla: line(screen.length, screen.filter((i) => i.status === 'in_progress').length, 'viendo', trackers.pantalla.tagline),
      libros: line(books.length, books.filter((i) => i.status === 'in_progress').length, 'leyendo', trackers.libros.tagline),
    } satisfies Record<TrackerId, string>
  }, [games, items])

  /** Termina el cronómetro desde el inicio: guarda la sesión del juego. */
  async function stopTimer() {
    const stopped = sessionTimer.stop()
    if (!stopped) return
    haptic([10, 40, 10])
    try {
      await ensureSession()
      const { error } = await supabase.from('activity_log').insert({
        item_id: stopped.gameId,
        duration_minutes: stopped.minutes,
        occurred_at: new Date(stopped.startedAt).toISOString(),
      })
      if (error) throw error
      await refreshGame(stopped.gameId)
      showToast(`Sesión de ${stopped.minutes} min registrada`)
    } catch (err) {
      showError(err, 'No se pudo guardar la sesión')
    }
  }

  function renderEntry(entry: NowEntry) {
    if (entry.kind === 'game') {
      const g = entry.game
      const running = timer?.gameId === g.id
      return (
        <NowCard
          key={g.id}
          tracker="juegos"
          to={gamesPaths.game(g.id)}
          cover={g.cover_url}
          icon={trackers.juegos.Icon}
          kicker="Juego"
          title={g.title}
          progress={
            running
              ? `Jugando ahora · ${formatElapsed(now - timer.startedAt)}`
              : g.hours_played > 0
                ? `${g.hours_played.toLocaleString('es')} h jugadas`
                : 'Sin horas todavía'
          }
          pct={null}
          action={
            running ? (
              <button type="button" onClick={stopTimer} className={actionClass}>
                <Square size={13} fill="currentColor" /> Terminar
              </button>
            ) : timer ? null : (
              <button
                type="button"
                onClick={() => {
                  haptic()
                  sessionTimer.start(g.id, g.title)
                }}
                className={actionClass}
              >
                <Play size={14} fill="currentColor" /> Jugar
              </button>
            )
          }
        />
      )
    }

    const i = entry.item
    const type = i.media_type as NonGameType
    const section = entry.tracker === 'libros' ? mediaSections.libros : mediaSections.pantalla
    const kind = progressKind(type)
    const total = i.progress_total
    const pct = total ? Math.min(100, Math.round((i.progress / total) * 100)) : null
    const busy = busyId === i.id
    const progress =
      kind === 'pages'
        ? `Página ${i.progress}${total ? ` de ${total} · ${pct}%` : ''}`
        : kind === 'episodes'
          ? i.progress === 0
            ? 'Sin empezar'
            : `Episodio ${i.progress}${total ? ` de ${total}` : ''}`
          : i.metadata.runtime_minutes
            ? formatMinutes(i.metadata.runtime_minutes)
            : 'Película'

    return (
      <NowCard
        key={i.id}
        tracker={entry.tracker}
        to={section.detailPath(i.id)}
        cover={i.cover_url}
        icon={mediaTypeIcons[type]}
        kicker={kind === 'pages' && i.metadata.authors?.[0] ? i.metadata.authors[0] : mediaTypeLabels[type]}
        title={i.title}
        progress={progress}
        pct={pct}
        action={
          kind === 'pages' ? (
            <button type="button" onClick={() => setPageBook(i)} className={actionClass}>
              <BookOpen size={14} /> Página
            </button>
          ) : (
            <button type="button" onClick={() => advance(i)} disabled={busy} className={actionClass}>
              {kind === 'none' ? (
                <>
                  <Check size={14} /> La vi
                </>
              ) : (
                <>
                  <Plus size={14} /> Ep. {i.progress + 1}
                </>
              )}
            </button>
          )
        }
      />
    )
  }

  return (
    <PageContainer>
      <header className="mb-6 flex items-center gap-3">
        <img src={asset('icons/icon-192.png')} alt="" className="h-12 w-12 rounded-2xl shadow-lg shadow-black/40" />
        <div>
          <h1 className="text-2xl font-bold text-accent">{greeting()}</h1>
          <p className="text-sm text-lavender first-letter:uppercase">
            {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </header>

      <div className="md:mx-auto md:max-w-xl">
        {!loading && <WeekStrip typeOf={typeOf} />}

        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-lavender">En curso</h2>
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : nowEntries.length === 0 ? (
            <p className="rounded-2xl bg-background-surface p-4 text-sm text-lavender ring-1 ring-primary-dark/30">
              Nada en curso. Cuando empieces un juego, una serie o un libro, va a aparecer acá para que lo sigas con un
              toque.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">{nowEntries.map(renderEntry)}</ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-lavender">Tus trackers</h2>
          <div className="flex flex-col gap-2">
            {trackerIds.map((id) => (
              <TrackerCard key={id} id={id} line={loading ? trackers[id].tagline : lines[id]} />
            ))}
            <Link
              to={listPaths.lists}
              className="flex items-center gap-3 rounded-2xl bg-background-surface p-3 ring-1 ring-primary-dark/30 active:bg-primary-dark/10"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <ClipboardList size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-ink">Mis listas</h3>
                <p className="truncate text-sm text-lavender">
                  {lists.length === 0
                    ? 'Agrupa juegos, películas y libros'
                    : `${lists.length} ${lists.length === 1 ? 'lista' : 'listas'}`}
                </p>
              </div>
              <ChevronRight size={20} className="text-accent" />
            </Link>
          </div>
        </section>

      </div>

      <PageSheet
        book={pageBook}
        busy={busyId != null}
        onClose={() => setPageBook(null)}
        onSave={async (page, minutes) => {
          const book = pageBook
          setPageBook(null)
          if (book) await setPage(book, page, minutes)
        }}
      />
    </PageContainer>
  )
}
