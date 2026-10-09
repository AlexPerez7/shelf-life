import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Flag, Play, Plus, Timer, type LucideIcon } from 'lucide-react'
import { supabase, ensureSession } from '../../lib/supabaseClient'
import { useGames } from '../../hooks/useGames'
import { PageContainer } from '../../components/PageContainer'
import { Skeleton } from '../../components/Skeleton'
import { formatDate, parseDate } from '../../lib/dates'
import { gamesPaths } from './paths'

interface TimelineEvent {
  key: string
  date: string
  icon: LucideIcon
  text: string
  gameId: string
}

interface SessionRow {
  id: string
  duration_minutes: number
  played_at: string
  game_id: string
  games: { title: string } | null
}

export function Timeline() {
  const navigate = useNavigate()
  const { games, loading: loadingGames } = useGames()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  useEffect(() => {
    ensureSession().then(() => {
      supabase
        .from('activity_log')
        .select(
          'id, duration_minutes, played_at:occurred_at, game_id:item_id, games:items!inner(title, media_type)'
        )
        .eq('games.media_type', 'game')
        .not('duration_minutes', 'is', null)
        .order('occurred_at', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          setSessions((data as unknown as SessionRow[]) ?? [])
          setLoadingSessions(false)
        })
    })
  }, [])

  const loading = loadingGames || loadingSessions

  const groups = useMemo(() => {
    const events: TimelineEvent[] = []

    for (const g of games) {
      events.push({
        key: `add-${g.id}`,
        date: g.created_at,
        icon: Plus,
        text: `Agregaste ${g.title} a tu biblioteca`,
        gameId: g.id,
      })
      if (g.date_started) {
        events.push({
          key: `start-${g.id}`,
          date: g.date_started,
          icon: Play,
          text: `Empezaste a jugar ${g.title}`,
          gameId: g.id,
        })
      }
      if (g.date_finished) {
        events.push({
          key: `finish-${g.id}`,
          date: g.date_finished,
          icon: Flag,
          text: `Completaste ${g.title}`,
          gameId: g.id,
        })
      }
    }

    // El título se toma de la biblioteca en memoria (siempre al día).
    const titles = new Map(games.map((g) => [g.id, g.title]))
    for (const s of sessions) {
      events.push({
        key: `session-${s.id}`,
        date: s.played_at,
        icon: Timer,
        text: `Jugaste ${s.duration_minutes} min de ${titles.get(s.game_id) ?? s.games?.title ?? 'un juego'}`,
        gameId: s.game_id,
      })
    }

    events.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())

    // Agrupar por mes: en una lista larga en el teléfono, las cabeceras
    // fijas ayudan a ubicarse al hacer scroll.
    const byMonth: { label: string; events: TimelineEvent[] }[] = []
    for (const e of events) {
      const label = parseDate(e.date).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
      const last = byMonth[byMonth.length - 1]
      if (last && last.label === label) last.events.push(e)
      else byMonth.push({ label, events: [e] })
    }
    return byMonth
  }, [games, sessions])

  return (
    <PageContainer>
      <button
        onClick={() => navigate(gamesPaths.stats)}
        className="-ml-2 mb-2 flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/20"
      >
        <ArrowLeft size={16} /> Estadísticas
      </button>

      <h1 className="mb-4 text-xl font-semibold">Diario</h1>

      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!loading && groups.length === 0 && (
        <p className="mt-8 text-center text-sm text-lavender">
          Todavía no hay actividad registrada.
        </p>
      )}

      {!loading &&
        groups.map((group) => (
          <section key={group.label} className="mb-4">
            <h2
              className="sticky z-10 -mx-4 bg-background/90 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-lavender backdrop-blur"
              style={{ top: 'env(safe-area-inset-top)' }}
            >
              {group.label}
            </h2>
            <ul className="flex flex-col gap-2">
              {group.events.map((e) => (
                <li key={e.key}>
                  <button
                    onClick={() => navigate(gamesPaths.game(e.gameId))}
                    className="flex w-full items-start gap-3 rounded-xl bg-background-surface p-3 text-left ring-1 ring-primary-dark/30 active:bg-primary-dark/20"
                  >
                    <e.icon className="mt-0.5 shrink-0 text-accent" size={20} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{e.text}</p>
                      <p className="text-xs text-lavender">{formatDate(e.date)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </PageContainer>
  )
}
