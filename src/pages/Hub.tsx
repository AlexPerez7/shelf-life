import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '@fontsource-variable/bricolage-grotesque'
import { BookOpen, Check, Play, Plus, Settings, Square } from 'lucide-react'
import { useGames } from '../hooks/useGames'
import { useMedia } from '../contexts/MediaContext'
import { useToast } from '../contexts/ToastContext'
import { formatElapsed, useNow, useSessionTimer } from '../contexts/SessionTimerContext'
import { useQuickProgress } from '../hooks/useQuickProgress'
import { useUpcoming } from '../hooks/useUpcoming'
import { PageContainer } from '../components/PageContainer'
import { PageSheet } from '../components/PageSheet'
import { HomeNav } from '../components/HomeNav'
import { Skeleton } from '../components/Skeleton'
import { useSaveStoppedTimer } from '../hooks/useSaveStoppedTimer'
import { haptic } from '../lib/haptics'
import {
  episodeLabel,
  episodeProgress,
  formatMinutes,
  itemSeasons,
  mediaSections,
  mediaTypeIcons,
  mediaTypeLabels,
  progressKind,
} from '../lib/media'
import { gamesPaths } from '../trackers/juegos/paths'
import { trackers } from '../trackers/trackers'
import { HeroCard } from './hub/HeroCard'
import { NowRail } from './hub/NowRail'
import { WeekPanel } from './hub/WeekPanel'
import { GoalRings } from './hub/GoalRings'
import { UpcomingRail } from './hub/UpcomingRail'
import type { NowModel } from './hub/nowModel'
import type { Game } from '../types/game'
import type { Item, MediaType, NonGameType } from '../types/item'

/** Cuántos en curso se muestran en el inicio (el primero es "Continuar"). */
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

/** Tiempo del cronómetro: lo único que se vuelve a dibujar cada segundo. */
function Elapsed({ startedAt }: { startedAt: number }) {
  const now = useNow(true)
  return <span className="tabular-nums">{formatElapsed(now - startedAt)}</span>
}

const primaryClass =
  'flex min-h-13 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 text-base font-semibold text-background transition-transform active:scale-[0.98]'
const secondaryClass =
  'flex h-13 w-13 shrink-0 items-center justify-center rounded-full text-accent ring-1 ring-accent/50 active:bg-accent/10'
const quickClass =
  'absolute top-[7.25rem] right-2 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-background shadow-lg shadow-black/40 transition-transform active:scale-95'

/**
 * Inicio de Shelf Life: "Continuar" con lo último que usaste, el resto de lo
 * que sigues en un carrusel (todo con acción de un toque: jugar, +1 episodio,
 * página), la semana, las metas y lo que se estrena. La barra de abajo lleva
 * a los trackers y a las listas.
 */
export function Hub() {
  const { games, loading: loadingGames } = useGames()
  const { items, loading: loadingMedia } = useMedia()
  const { showToast, showError } = useToast()
  const sessionTimer = useSessionTimer()
  const timer = sessionTimer.timer
  const { advance, setPage } = useQuickProgress()
  const [pageBook, setPageBook] = useState<Item | null>(null)
  const [pageMinutes, setPageMinutes] = useState<number | null>(null)
  const saveStoppedTimer = useSaveStoppedTimer()
  // Estrenos de los próximos 7 días de lo que sigues en Pantalla.
  const upcoming = useUpcoming(items)
  const [weekEnd] = useState(() => Date.now() + 7 * 24 * 60 * 60 * 1000)
  const upcomingWeek = useMemo(() => (upcoming ?? []).filter((e) => e.date.getTime() < weekEnd), [upcoming, weekEnd])

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

  /**
   * Termina el cronómetro desde el inicio. Juego: guarda la sesión. Libro:
   * abre la hoja de página con los minutos ya puestos.
   */
  async function stopTimer() {
    const stopped = sessionTimer.stop()
    if (!stopped) return
    haptic([10, 40, 10])
    if (stopped.kind === 'book') {
      const book = items.find((i) => i.id === stopped.gameId)
      if (book) {
        setPageMinutes(stopped.minutes)
        setPageBook(book)
        return
      }
    }
    try {
      await saveStoppedTimer(stopped)
      showToast(`Sesión de ${stopped.minutes} min registrada`)
    } catch (err) {
      showError(err, 'No se pudo guardar la sesión')
    }
  }

  /** Empieza a leer: cronómetro de lectura (si hay otro corriendo, no se ofrece). */
  function startReading(book: Item) {
    haptic()
    sessionTimer.start(book.id, book.title, 'book')
  }

  /** Una entrada en curso, lista para las tarjetas (con sus acciones). */
  function toModel(entry: NowEntry): NowModel {
    if (entry.kind === 'game') {
      const g = entry.game
      const running = timer?.gameId === g.id
      const start = () => {
        haptic()
        sessionTimer.start(g.id, g.title)
      }
      return {
        key: g.id,
        tracker: 'juegos',
        to: gamesPaths.game(g.id),
        cover: g.cover_url,
        icon: trackers.juegos.Icon,
        kicker: 'Jugando · Juego',
        title: g.title,
        byline: g.platform ?? 'Juego',
        progress: running ? (
          <>
            Jugando ahora · <Elapsed startedAt={timer.startedAt} />
          </>
        ) : g.hours_played > 0 ? (
          `${g.hours_played.toLocaleString('es')} h jugadas`
        ) : (
          'Sin horas todavía'
        ),
        pct: null,
        primary: running ? (
          <button type="button" onClick={stopTimer} className={primaryClass}>
            <Square size={16} fill="currentColor" /> Terminar
          </button>
        ) : timer ? null : (
          <button type="button" onClick={start} className={primaryClass}>
            <Play size={18} fill="currentColor" /> Jugar
          </button>
        ),
        quick: running ? (
          <button type="button" onClick={stopTimer} aria-label={`Terminar la sesión de ${g.title}`} className={quickClass}>
            <Square size={15} fill="currentColor" />
          </button>
        ) : timer ? null : (
          <button type="button" onClick={start} aria-label={`Jugar ${g.title}`} className={quickClass}>
            <Play size={17} fill="currentColor" />
          </button>
        ),
      }
    }

    const i = entry.item
    const type = i.media_type as NonGameType
    const section = entry.tracker === 'libros' ? mediaSections.libros : mediaSections.pantalla
    const kind = progressKind(type)
    const total = i.progress_total
    const pct = total ? Math.min(100, Math.round((i.progress / total) * 100)) : null
    const progress =
      kind === 'pages'
        ? `Página ${i.progress}${total ? ` de ${total}` : ''}`
        : kind === 'episodes'
          ? episodeProgress(i)
          : i.metadata.runtime_minutes
            ? formatMinutes(i.metadata.runtime_minutes)
            : 'Película'
    const base = {
      key: i.id,
      tracker: entry.tracker,
      to: section.detailPath(i.id),
      cover: i.cover_url,
      icon: mediaTypeIcons[type],
      kicker: `${section.statusLabels.in_progress} · ${mediaTypeLabels[type]}`,
      title: i.title,
      byline: (kind === 'pages' ? i.metadata.authors?.[0] : i.release_date?.slice(0, 4)) ?? mediaTypeLabels[type],
      progress,
      pct,
    }

    if (kind === 'pages') {
      const reading = timer?.gameId === i.id
      return {
        ...base,
        primary: reading ? (
          <button type="button" onClick={stopTimer} className={primaryClass}>
            <Square size={16} fill="currentColor" /> Terminar
          </button>
        ) : (
          <>
            {!timer && (
              <button type="button" onClick={() => startReading(i)} className={primaryClass}>
                <Play size={18} fill="currentColor" /> Leer
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setPageMinutes(null)
                setPageBook(i)
              }}
              aria-label={`Anotar la página de ${i.title}`}
              className={`${secondaryClass} ${timer ? 'flex-1 w-auto gap-2 text-sm font-semibold' : ''}`}
            >
              <BookOpen size={20} />
              {timer && 'Anotar la página'}
            </button>
          </>
        ),
        quick: reading ? (
          <button type="button" onClick={stopTimer} aria-label={`Terminar la lectura de ${i.title}`} className={quickClass}>
            <Square size={15} fill="currentColor" />
          </button>
        ) : timer ? null : (
          <button type="button" onClick={() => startReading(i)} aria-label={`Leer ${i.title}`} className={quickClass}>
            <Play size={17} fill="currentColor" />
          </button>
        ),
      }
    }

    const label = kind === 'none' ? 'La vi' : episodeLabel(i.progress + 1, itemSeasons(i))
    return {
      ...base,
      primary: (
        <button type="button" onClick={() => advance(i)} className={primaryClass}>
          {kind === 'none' ? <Check size={18} /> : <Plus size={18} />} {label}
        </button>
      ),
      quick: (
        <button type="button" onClick={() => advance(i)} aria-label={`${label}: ${i.title}`} className={quickClass}>
          {kind === 'none' ? <Check size={18} /> : <Plus size={18} />}
        </button>
      ),
    }
  }

  const models = nowEntries.map(toModel)
  const [hero, ...rail] = models

  return (
    <PageContainer>
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-tight font-extrabold tracking-tight text-ink">{greeting()}</h1>
          <p className="mt-1 text-sm text-lavender first-letter:uppercase">
            {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link
          to="/ajustes"
          aria-label="Ajustes"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background-surface text-ink active:bg-primary-dark/20"
        >
          <Settings size={21} strokeWidth={1.8} />
        </Link>
      </header>

      <div className="flex flex-col gap-7 md:mx-auto md:max-w-xl">
        {loading ? (
          <Skeleton className="h-80 w-full rounded-[1.75rem]" />
        ) : hero ? (
          <HeroCard m={hero} />
        ) : (
          <p className="rounded-3xl bg-background-surface p-5 text-sm text-lavender ring-1 ring-primary-dark/30">
            Nada en curso. Cuando empieces un juego, una serie o un libro, va a aparecer acá para que lo sigas con un
            toque.
          </p>
        )}

        {!loading && <NowRail entries={rail} />}
        {!loading && <WeekPanel typeOf={typeOf} />}
        {!loading && <GoalRings games={games} items={items} />}
        <UpcomingRail entries={upcomingWeek} />
      </div>

      <HomeNav />

      <PageSheet
        book={pageBook}
        minutes={pageMinutes}
        onClose={() => {
          // Si se cierra sin guardar después del cronómetro, el tiempo no se pierde.
          if (pageBook && pageMinutes) setPage(pageBook, pageBook.progress, pageMinutes)
          setPageBook(null)
          setPageMinutes(null)
        }}
        onSave={async (page, minutes) => {
          const book = pageBook
          setPageBook(null)
          setPageMinutes(null)
          if (book) await setPage(book, page, minutes)
        }}
      />
    </PageContainer>
  )
}
