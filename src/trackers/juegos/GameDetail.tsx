import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, Gamepad2, Heart, StickyNote } from 'lucide-react'
import { useGames } from '../../hooks/useGames'
import { ListPicker } from '../../components/ListPicker'
import { StatusSheet } from '../../components/StatusSheet'
import { GameDeals } from '../../components/GameDeals'
import { CoverPicker } from '../../components/CoverPicker'
import { TimeToBeat } from '../../components/TimeToBeat'
import { Skeleton } from '../../components/Skeleton'
import { PageContainer } from '../../components/PageContainer'
import { gameCoverOptions } from '../../lib/igdb'
import { showsDeals, statusColors, statusLabels } from '../../lib/status'
import { haptic } from '../../lib/haptics'
import { todayISO } from '../../lib/dates'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import type { Game } from '../../types/game'
import { gamesPaths } from './paths'
import { useGameDraft } from './detail/useGameDraft'
import { useGameSessions } from './detail/useGameSessions'
import { GameHero } from './detail/GameHero'
import { CompactHeader, SaveIndicator } from './detail/CompactHeader'
import { ProgressCard } from './detail/ProgressCard'
import { SessionsCard } from './detail/SessionsCard'
import { NotesCard } from './detail/NotesCard'
import { AboutCard } from './detail/AboutCard'
import { MoreDetails } from './detail/MoreDetails'

/**
 * Detalle de un juego. Arma la pantalla con las secciones de `detail/`: el
 * guardado automático vive en `useGameDraft` y las sesiones y el cronómetro
 * en `useGameSessions`.
 */
export function GameDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { games, loading, deleteGame } = useGames()
  const { showToast, showError } = useToast()
  const confirm = useConfirm()
  const game = games.find((g) => g.id === id)

  const { draft, setField, flush, discard, saveState } = useGameDraft(id)
  const current = game ? { ...game, ...draft } : undefined
  const status = current?.status ?? 'pendiente'

  const [coverOpen, setCoverOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const notesRef = useRef<HTMLDivElement>(null)
  const closeStatusSheet = useCallback(() => setStatusOpen(false), [])

  // Cabecera compacta: aparece cuando el título grande sale de pantalla.
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [compactVisible, setCompactVisible] = useState(false)
  const gameLoaded = game != null
  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) =>
      setCompactVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [gameLoaded])

  function handleStatusChange(newStatus: Game['status']) {
    if (!current) return
    setStatusOpen(false)
    haptic()
    const changes: Partial<Game> = { status: newStatus }
    // Completar las fechas automáticamente: el Diario se arma con ellas.
    if (newStatus === 'jugando' && !current.date_started) {
      changes.date_started = todayISO()
    }
    if (newStatus === 'completado' && !current.date_finished) {
      changes.date_finished = todayISO()
    }
    setField(changes, { immediate: true })
  }

  const sessions = useGameSessions(id, current, flush, () => handleStatusChange('jugando'))

  function goBack() {
    // Si se llegó navegando dentro de la app, volver atrás conserva los
    // filtros y el scroll de la pantalla anterior. Si se abrió por link
    // directo no hay historial propio: ir a la biblioteca.
    if (location.key !== 'default') navigate(-1)
    else navigate(gamesPaths.library)
  }

  async function handleDelete() {
    if (!game) return
    const ok = await confirm({
      title: `¿Eliminar "${game.title}"?`,
      message:
        'Se borra de tu biblioteca junto con sus sesiones registradas y se quita de tus listas. No se puede deshacer.',
      confirmLabel: 'Eliminar juego',
      danger: true,
    })
    if (!ok) return
    try {
      discard()
      await deleteGame(game.id)
      showToast(`"${game.title}" se eliminó de tu biblioteca`)
      navigate(gamesPaths.library, { replace: true })
    } catch (err) {
      showError(err, 'No se pudo eliminar el juego')
    }
  }

  function toggleFavorite() {
    if (!current) return
    haptic()
    setField({ is_favorite: !current.is_favorite }, { immediate: true })
  }

  if (loading) {
    return (
      <PageContainer>
        <Skeleton className="mb-4 h-4 w-16" />
        <div className="mb-4 flex gap-3">
          <Skeleton className="h-32 w-24 flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </PageContainer>
    )
  }

  if (!game || !current) {
    return (
      <PageContainer>
        <p className="text-sm text-lavender">No se encontró el juego.</p>
        <button onClick={() => navigate(gamesPaths.library)} className="mt-4 text-accent">
          Volver a la biblioteca
        </button>
      </PageContainer>
    )
  }

  return (
    <>
      <GameHero
        title={game.title}
        coverUrl={current.cover_url}
        onBack={goBack}
        onChangeCover={() => setCoverOpen(true)}
        onDelete={handleDelete}
      />

      <CoverPicker
        currentUrl={current.cover_url}
        load={() => gameCoverOptions(current)}
        open={coverOpen}
        onClose={() => setCoverOpen(false)}
        icon={Gamepad2}
        onPick={(cover_url) => {
          setCoverOpen(false)
          haptic()
          setField({ cover_url }, { immediate: true })
          showToast('Portada cambiada')
        }}
      />

      <CompactHeader
        visible={compactVisible}
        title={game.title}
        isFavorite={current.is_favorite}
        saveState={saveState}
        onBack={goBack}
        onRetry={flush}
        onToggleFavorite={toggleFavorite}
      />

      <PageContainer belowHero>
        <div className="mx-auto md:max-w-xl">
          <div className="flex items-start justify-between gap-3">
            <h1 ref={titleRef} className="min-w-0 text-2xl font-bold">
              {game.title}
            </h1>
            <SaveIndicator state={saveState} onRetry={flush} />
          </div>
          {game.first_release_date && (
            <p className="mt-0.5 text-sm text-lavender">
              {new Date(game.first_release_date * 1000).getFullYear()}
            </p>
          )}

          <div className="mb-5 mt-3 flex items-center gap-2">
            <button
              onClick={() => setStatusOpen(true)}
              className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium ${statusColors[status]}`}
            >
              {statusLabels[status]}
              <ChevronDown size={14} />
            </button>
            <StatusSheet
              open={statusOpen}
              onClose={closeStatusSheet}
              value={status}
              onChange={handleStatusChange}
            />
            <button
              onClick={toggleFavorite}
              aria-label={current.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
              aria-pressed={current.is_favorite}
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ring-1 ring-primary-dark/30 ${
                current.is_favorite ? 'bg-accent text-primary-darker' : 'bg-background-surface text-lavender'
              }`}
            >
              <Heart size={18} fill={current.is_favorite ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              aria-label="Ir a notas y reseña"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-background-surface text-lavender ring-1 ring-primary-dark/30"
            >
              <StickyNote size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <ProgressCard
              game={current}
              setField={setField}
              timerStartedAt={sessions.timerStartedAt}
              onStartTimer={sessions.startTimer}
              onStopTimer={sessions.stopTimer}
              onCancelTimer={sessions.cancelTimer}
            />

            <SessionsCard
              sessions={sessions.sessions}
              onAdd={sessions.addManualSession}
              onDelete={sessions.removeSession}
              isPending={sessions.isPending}
            />

            {/* Estas dos secciones incluyen su propia tarjeta y no se muestran
                si no hay datos (juego de consola sin precios, IGDB sin tiempos). */}
            {showsDeals(status) && (
              <GameDeals title={game.title} steamAppId={game.steam_appid} />
            )}

            <TimeToBeat igdbId={game.igdb_id} title={game.title} />

            <NotesCard
              notes={current.notes}
              review={current.review}
              setField={setField}
              sectionRef={notesRef}
            />

            <ListPicker itemId={game.id} />

            {game.summary && <AboutCard summary={game.summary} />}

            <MoreDetails game={current} setField={setField} />
          </div>
        </div>
      </PageContainer>
    </>
  )
}
