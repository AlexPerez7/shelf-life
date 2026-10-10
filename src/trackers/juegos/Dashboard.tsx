import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bookmark,
  CheckCircle2,
  Flame,
  Gamepad2,
  Hourglass,
  Joystick,
  LogOut,
  Star,
  Tag,
  Timer,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useGames } from '../../hooks/useGames'
import { StatsCard } from '../../components/StatsCard'
import { SectionCard } from '../../components/SectionCard'
import { Skeleton, StatsCardSkeleton } from '../../components/Skeleton'
import { PageContainer } from '../../components/PageContainer'
import { TrackerBar } from '../../components/TrackerBar'
import { parseTags } from '../../lib/tags'
import { plural } from '../../lib/text'
import { parseDate } from '../../lib/dates'
import { statusLabels, statuses } from '../../lib/status'
import { getTimeToBeatBatch } from '../../lib/igdb'
import { useAuth } from '../../hooks/useAuth'
import { useSignOut } from '../../hooks/useSignOut'
import { useToast } from '../../contexts/ToastContext'
import { useActivity } from '../../hooks/useActivity'
import { MonthlyBars } from '../../components/stats/MonthlyBars'
import { RankBars } from '../../components/stats/RankBars'
import { YearRecap } from '../../components/stats/YearRecap'
import { GoalCard } from '../../components/stats/GoalCard'
import { monthBuckets, type ActivityRow } from '../../lib/stats'
import type { Game } from '../../types/game'
import { gamesPaths } from './paths'

const MONTHS_SHOWN = 6
const GAME_TYPES = ['game' as const]

function round1(n: number) {
  return Math.round(n * 10) / 10
}

export function Dashboard() {
  const { games, loading } = useGames()
  // Sesiones de los últimos 12 meses (gráfico mensual, ritmo y resumen anual).
  const activity = useActivity(GAME_TYPES)
  const sessions = useMemo(
    () => activity?.filter((r) => (r.duration_minutes ?? 0) > 0) ?? null,
    [activity]
  )

  const stats = useMemo(() => {
    const owned = games.filter((g) => g.status !== 'deseado')
    const count = (s: Game['status']) => games.filter((g) => g.status === s).length
    const completados = count('completado')
    // Redondeo a 1 decimal: la suma de numerics como float deja cosas como 12.300000000000001.
    const totalHoras = round1(games.reduce((sum, g) => sum + Number(g.hours_played ?? 0), 0))

    const genreCounts = new Map<string, number>()
    for (const g of owned) {
      for (const genre of parseTags(g.genre)) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1)
      }
    }
    const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

    const topRated = games
      .filter((g) => g.rating != null)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]

    const mostPlayed = games
      .filter((g) => g.hours_played > 0)
      .sort((a, b) => b.hours_played - a.hours_played)[0]

    // Tasa de finalización: sobre lo que se tiene (sin deseados).
    const completionRate = owned.length ? Math.round((completados / owned.length) * 100) : 0

    return {
      total: owned.length,
      completados,
      jugando: count('jugando'),
      deseados: count('deseado'),
      totalHoras,
      topGenre,
      topRated,
      mostPlayed,
      completionRate,
      byStatus: statuses.map((s) => ({ status: s, count: count(s) })),
    }
  }, [games])

  const highlights = [
    stats.topGenre && { icon: Tag, label: 'Género favorito', value: stats.topGenre },
    stats.topRated && {
      icon: Star,
      label: 'Mejor puntuado',
      value: stats.topRated.title,
      to: gamesPaths.game(stats.topRated.id),
    },
    stats.mostPlayed && {
      icon: Flame,
      label: 'Más jugado',
      value: stats.mostPlayed.title,
      to: gamesPaths.game(stats.mostPlayed.id),
    },
  ].filter(Boolean) as { icon: LucideIcon; label: string; value: string; to?: string }[]

  return (
    <PageContainer>
      <TrackerBar tracker="juegos" />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Estadísticas</h1>
        <Link
          to={gamesPaths.diary}
          className="-mr-2 flex min-h-11 items-center rounded-full px-2 text-sm text-accent active:bg-primary-dark/20"
        >
          Ver diario →
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <GoalCard tracker="juegos" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatsCard label="En tu biblioteca" value={stats.total} icon={Gamepad2} to={gamesPaths.library} />
            <StatsCard
              label="Completados"
              value={stats.completados}
              icon={CheckCircle2}
              to={`${gamesPaths.library}?estado=completado`}
            />
            <StatsCard label="En curso" value={stats.jugando} icon={Joystick} to={`${gamesPaths.library}?estado=jugando`} />
            <StatsCard label="Horas totales" value={`${stats.totalHoras}h`} icon={Timer} />
          </div>

          {stats.deseados > 0 && (
            <Link
              to={`${gamesPaths.library}?estado=deseado`}
              className="flex min-h-12 items-center justify-between gap-3 rounded-lg bg-background-surface px-3 ring-1 ring-primary-dark/30 active:bg-primary-dark/20"
            >
              <span className="flex items-center gap-1.5 text-sm text-lavender">
                <Bookmark size={16} /> Deseados
              </span>
              <span className="text-sm font-medium text-ink">{stats.deseados} →</span>
            </Link>
          )}

          <BacklogCard games={games} sessions={sessions} />

          <MonthlyBars
            icon={Timer}
            title="Horas jugadas por mes"
            months={
              sessions && monthBuckets(sessions, MONTHS_SHOWN, (r) => (r.duration_minutes ?? 0) / 60).map((m) => ({ ...m, value: round1(m.value) }))
            }
            format={(h) => `${h.toLocaleString('es')} h`}
            emptyText='Registra sesiones (o usa el cronómetro "Jugar" en un juego) para ver tu ritmo mes a mes.'
            footnote="Según las sesiones registradas (las horas importadas de Steam no tienen fecha)."
          />

          <SectionCard icon={CheckCircle2} title="Por estado">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm text-lavender">Terminaste</span>
              <span className="text-sm text-ink">
                <strong className="text-lg">{stats.completionRate}%</strong> de tu biblioteca
              </span>
            </div>
            <RankBars
              rows={stats.byStatus
                .filter((r) => r.count > 0)
                .map((r) => ({
                  label: statusLabels[r.status],
                  value: r.count,
                  to: `${gamesPaths.library}?estado=${r.status}`,
                }))}
            />
          </SectionCard>

          {highlights.length > 0 && (
            <div className="flex flex-col gap-2">
              {highlights.map((h) => {
                const inner = (
                  <>
                    <span className="flex flex-shrink-0 items-center gap-1.5 text-sm text-lavender">
                      <h.icon size={16} /> {h.label}
                    </span>
                    <span className="truncate text-sm font-medium text-ink">{h.value}</span>
                  </>
                )
                const className =
                  'flex min-h-12 items-center justify-between gap-3 rounded-lg bg-background-surface px-3 ring-1 ring-primary-dark/30'
                return h.to ? (
                  <Link key={h.label} to={h.to} className={`${className} active:bg-primary-dark/20`}>
                    {inner}
                  </Link>
                ) : (
                  <div key={h.label} className={className}>
                    {inner}
                  </div>
                )
              })}
            </div>
          )}

          <GamesYearRecap games={games} sessions={sessions} />
        </div>
      )}

      <AccountCard />
    </PageContainer>
  )
}

/**
 * Cuánto falta para terminar el backlog (pendientes, en pausa y jugando),
 * usando la duración "normal" de IGDB menos lo ya jugado. Solo cuenta juegos
 * con igdb_id; los demás se informan aparte.
 */
function BacklogCard({ games, sessions }: { games: Game[]; sessions: ActivityRow[] | null }) {
  const backlog = useMemo(
    () => games.filter((g) => ['pendiente', 'en_pausa', 'jugando'].includes(g.status)),
    [games]
  )
  const ids = useMemo(
    () => backlog.map((g) => g.igdb_id).filter((id): id is number => id != null),
    [backlog]
  )
  const idsKey = ids.join(',')
  const [ttb, setTtb] = useState<Record<number, { normallyHours: number | null }> | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!idsKey) return
    getTimeToBeatBatch(idsKey.split(',').map(Number))
      .then(setTtb)
      .catch(() => setFailed(true))
  }, [idsKey])

  if (backlog.length === 0 || failed) return null

  let remaining = 0
  let withData = 0
  if (ttb) {
    for (const g of backlog) {
      const normal = g.igdb_id != null ? ttb[g.igdb_id]?.normallyHours : null
      if (normal == null) continue
      withData++
      remaining += Math.max(0, normal - Number(g.hours_played ?? 0))
    }
  }
  remaining = Math.round(remaining)

  // Ritmo: horas registradas en sesiones en los últimos 90 días.
  const since = Date.now() - 90 * 24 * 60 * 60 * 1000
  const recentHours =
    (sessions ?? [])
      .filter((s) => new Date(s.occurred_at).getTime() >= since)
      .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0) / 60
  const perWeek = recentHours / (90 / 7)
  const weeks = perWeek > 0 ? Math.ceil(remaining / perWeek) : null

  return (
    <SectionCard icon={Hourglass} title="Tu backlog">
      {!ttb && ids.length > 0 ? (
        <Skeleton className="h-16 w-full" />
      ) : withData === 0 ? (
        <p className="text-sm text-lavender">
          {plural(backlog.length, 'juego')} por terminar. Sin duraciones estimadas todavía: los juegos
          agregados desde IGDB (o completados con IGDB desde Importar de Steam) las traen.
        </p>
      ) : (
        <>
          <p className="text-sm text-lavender">Te faltan aproximadamente</p>
          <p className="text-3xl font-bold text-ink">
            {remaining.toLocaleString()} <span className="text-lg font-semibold">horas</span>
          </p>
          <p className="mt-1 text-sm text-lavender">
            para terminar{' '}
            {withData === backlog.length
              ? withData === 1
                ? 'tu juego en curso'
                : `tus ${withData} juegos en curso`
              : `${withData} de tus ${backlog.length} juegos en curso`}{' '}
            (pendientes, en pausa y jugando)
            {weeks != null && (
              <>
                {' '}
                · a tu ritmo actual ({round1(perWeek)} h/semana), unas{' '}
                <strong className="text-ink">
                  {weeks > 104 ? `${Math.round(weeks / 52)} años` : `${weeks} semanas`}
                </strong>
              </>
            )}
            .
          </p>
          <p className="mt-2 text-xs text-lavender/70">Duración "normal" estimada vía IGDB.</p>
        </>
      )}
    </SectionCard>
  )
}

/** Resumen del año en curso, para compartir. */
function GamesYearRecap({ games, sessions }: { games: Game[]; sessions: ActivityRow[] | null }) {
  const year = new Date().getFullYear()

  const lines = useMemo(() => {
    const finished = games.filter((g) => g.date_finished && parseDate(g.date_finished).getFullYear() === year)
    const added = games.filter((g) => new Date(g.created_at).getFullYear() === year).length
    const yearSessions = (sessions ?? []).filter((s) => new Date(s.occurred_at).getFullYear() === year)
    const hours = round1(yearSessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0) / 60)
    const byGame = new Map<string, number>()
    for (const s of yearSessions) byGame.set(s.item_id, (byGame.get(s.item_id) ?? 0) + (s.duration_minutes ?? 0))
    const topId = [...byGame.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const top = games.find((g) => g.id === topId)
    return [
      finished.length > 0 && `✅ ${plural(finished.length, 'juego terminado', 'juegos terminados')}`,
      hours > 0 && `⏱️ ${hours} horas registradas`,
      top && `🔥 Lo que más jugué: ${top.title}`,
      added > 0 && `📚 ${plural(added, 'juego nuevo', 'juegos nuevos')} en mi biblioteca`,
    ].filter(Boolean) as string[]
  }, [games, sessions, year])

  return <YearRecap year={year} heading={`Mi ${year} en Shelf Life 🎮`} lines={lines} />
}

function AccountCard() {
  const { session } = useAuth()
  const signOut = useSignOut()
  const { showError } = useToast()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const result = await signOut()
    if (!result || result.error) {
      if (result?.error) showError(result.error, 'No se pudo cerrar la sesión')
      setSigningOut(false)
    }
  }

  return (
    <div className="mt-8 rounded-lg bg-background-surface p-3 ring-1 ring-primary-dark/30">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-dark/30 text-lavender">
          <UserRound size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-lavender">Sesión iniciada como</p>
          <p className="truncate text-sm text-ink">{session?.user.email ?? '—'}</p>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-error active:bg-error/10 disabled:opacity-50"
        >
          <LogOut size={16} />
          {signingOut ? 'Saliendo...' : 'Salir'}
        </button>
      </div>
    </div>
  )
}
