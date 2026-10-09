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
  Share2,
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
import { supabase, ensureSession } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import type { Game } from '../../types/game'
import { gamesPaths } from './paths'

interface SessionRow {
  duration_minutes: number
  played_at: string
  game_id: string
}

const MONTHS_SHOWN = 6

function round1(n: number) {
  return Math.round(n * 10) / 10
}

/** Sesiones de los últimos 12 meses (gráfico mensual, ritmo y resumen anual). */
function useRecentSessions() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  useEffect(() => {
    const since = new Date()
    since.setMonth(since.getMonth() - 12, 1)
    ensureSession().then(() =>
      supabase
        .from('activity_log')
        .select('duration_minutes, played_at:occurred_at, game_id:item_id, items!inner(media_type)')
        .eq('items.media_type', 'game')
        .not('duration_minutes', 'is', null)
        .gte('occurred_at', since.toISOString())
        .then(({ data }) => setSessions((data as SessionRow[]) ?? []))
    )
  }, [])
  return sessions
}

export function Dashboard() {
  const { games, loading } = useGames()
  const sessions = useRecentSessions()

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

          <MonthlyHoursChart sessions={sessions} />

          <SectionCard icon={CheckCircle2} title="Por estado">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm text-lavender">Terminaste</span>
              <span className="text-sm text-ink">
                <strong className="text-lg">{stats.completionRate}%</strong> de tu biblioteca
              </span>
            </div>
            <StatusBars rows={stats.byStatus} />
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

          <YearRecap games={games} sessions={sessions} />
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
function BacklogCard({ games, sessions }: { games: Game[]; sessions: SessionRow[] | null }) {
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
      .filter((s) => new Date(s.played_at).getTime() >= since)
      .reduce((sum, s) => sum + s.duration_minutes, 0) / 60
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

/** Barras de horas por mes (una sola serie: sin leyenda, un solo tono). */
function MonthlyHoursChart({ sessions }: { sessions: SessionRow[] | null }) {
  const months = useMemo(() => {
    const now = new Date()
    const list = Array.from({ length: MONTHS_SHOWN }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_SHOWN - 1 - i), 1)
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        short: d.toLocaleDateString(undefined, { month: 'short' }).replace('.', ''),
        long: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        hours: 0,
      }
    })
    const byKey = new Map(list.map((m) => [m.key, m]))
    for (const s of sessions ?? []) {
      const d = parseDate(s.played_at)
      const m = byKey.get(`${d.getFullYear()}-${d.getMonth()}`)
      if (m) m.hours += s.duration_minutes / 60
    }
    return list.map((m) => ({ ...m, hours: round1(m.hours) }))
  }, [sessions])

  const [selected, setSelected] = useState(MONTHS_SHOWN - 1)
  const max = Math.max(...months.map((m) => m.hours), 1)
  const current = months[selected]
  const total = round1(months.reduce((sum, m) => sum + m.hours, 0))

  return (
    <SectionCard icon={Timer} title="Horas jugadas por mes">
      {sessions == null ? (
        <Skeleton className="h-40 w-full" />
      ) : total === 0 ? (
        <p className="text-sm text-lavender">
          Registra sesiones (o usa el cronómetro "Jugar" en un juego) para ver tu ritmo mes a mes.
        </p>
      ) : (
        <>
          <p className="text-sm text-lavender first-letter:uppercase">{current.long}</p>
          <p className="mb-3 text-2xl font-bold text-ink">{current.hours} h</p>
          <div
            className="flex h-32 items-end gap-2 border-b border-primary-dark/40"
            role="list"
            aria-label="Horas por mes"
          >
            {months.map((m, i) => (
              <button
                key={m.key}
                type="button"
                role="listitem"
                onClick={() => setSelected(i)}
                aria-label={`${m.long}: ${m.hours} horas`}
                aria-pressed={i === selected}
                className="flex h-full flex-1 items-end justify-center"
              >
                <span
                  className={`w-full max-w-7 rounded-t transition-colors ${
                    i === selected ? 'bg-accent' : 'bg-primary'
                  }`}
                  style={{ height: `${Math.max(m.hours > 0 ? 3 : 0, (m.hours / max) * 100)}%` }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2">
            {months.map((m, i) => (
              <span
                key={m.key}
                className={`flex-1 text-center text-[11px] capitalize ${
                  i === selected ? 'font-semibold text-ink' : 'text-lavender'
                }`}
              >
                {m.short}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-lavender/70">
            Según las sesiones registradas (las horas importadas de Steam no tienen fecha).
          </p>
        </>
      )}
    </SectionCard>
  )
}

/** Distribución por estado: barras horizontales etiquetadas (magnitud, un tono). */
function StatusBars({ rows }: { rows: { status: Game['status']; count: number }[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <ul className="flex flex-col gap-1">
      {rows
        .filter((r) => r.count > 0)
        .map((r) => (
          <li key={r.status}>
            <Link
              to={`${gamesPaths.library}?estado=${r.status}`}
              className="flex min-h-9 items-center gap-3 rounded-lg active:bg-primary-dark/20"
            >
              <span className="w-24 flex-shrink-0 text-sm text-lavender">{statusLabels[r.status]}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-primary-dark/20">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </span>
              <span className="w-8 flex-shrink-0 text-right text-sm font-medium tabular-nums text-ink">
                {r.count}
              </span>
            </Link>
          </li>
        ))}
    </ul>
  )
}

/** Resumen del año en curso, para compartir. */
function YearRecap({ games, sessions }: { games: Game[]; sessions: SessionRow[] | null }) {
  const { showToast } = useToast()
  const year = new Date().getFullYear()

  const recap = useMemo(() => {
    const finished = games.filter(
      (g) => g.date_finished && parseDate(g.date_finished).getFullYear() === year
    )
    const added = games.filter((g) => new Date(g.created_at).getFullYear() === year).length
    const yearSessions = (sessions ?? []).filter((s) => new Date(s.played_at).getFullYear() === year)
    const hours = round1(yearSessions.reduce((sum, s) => sum + s.duration_minutes, 0) / 60)
    const byGame = new Map<string, number>()
    for (const s of yearSessions) byGame.set(s.game_id, (byGame.get(s.game_id) ?? 0) + s.duration_minutes)
    const topId = [...byGame.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const top = games.find((g) => g.id === topId)
    return { finished, added, hours, top }
  }, [games, sessions, year])

  if (recap.finished.length === 0 && recap.hours === 0 && recap.added === 0) return null

  const lines = [
    `Mi ${year} en Shelf Life 🎮`,
    recap.finished.length > 0 &&
      `✅ ${plural(recap.finished.length, 'juego terminado', 'juegos terminados')}`,
    recap.hours > 0 && `⏱️ ${recap.hours} horas registradas`,
    recap.top && `🔥 Lo que más jugué: ${recap.top.title}`,
    recap.added > 0 &&
      `📚 ${plural(recap.added, 'juego nuevo', 'juegos nuevos')} en mi biblioteca`,
  ].filter(Boolean) as string[]

  async function share() {
    const text = lines.join('\n')
    try {
      if (navigator.share) {
        await navigator.share({ title: `Mi ${year} en Shelf Life`, text })
      } else {
        await navigator.clipboard.writeText(text)
        showToast('Resumen copiado al portapapeles')
      }
    } catch {
      /* el usuario cerró el menú de compartir */
    }
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary-darker to-primary-dark p-4 ring-1 ring-accent/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-lavender">Tu {year}</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-ink">
        {lines.slice(1).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={share}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-primary-darker"
      >
        <Share2 size={16} /> Compartir resumen
      </button>
    </div>
  )
}

function AccountCard() {
  const { session, signOut } = useAuth()
  const { showError } = useToast()
  const confirm = useConfirm()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    const ok = await confirm({
      title: '¿Cerrar sesión?',
      message: 'Tus datos quedan guardados en tu cuenta; solo se cierra la sesión en este dispositivo.',
      confirmLabel: 'Cerrar sesión',
      danger: true,
    })
    if (!ok) return
    setSigningOut(true)
    const { error } = await signOut()
    if (error) {
      showError(error, 'No se pudo cerrar la sesión')
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
