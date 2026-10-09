import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  BookOpen,
  Calendar,
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Disc,
  Gamepad2,
  Heart,
  Info,
  Layers,
  ListChecks,
  Loader2,
  Minus,
  MoreVertical,
  Pencil,
  Play,
  Square,
  Plus,
  Repeat,
  SlidersHorizontal,
  StickyNote,
  Tag,
  Trash2,
  Trophy,
  X,
} from 'lucide-react'
import { useGames } from '../hooks/useGames'
import { supabase } from '../lib/supabaseClient'
import { usePlaySessions } from '../hooks/usePlaySessions'
import { useLists, useGameListIds } from '../hooks/useLists'
import { StarRating } from '../components/StarRating'
import { TagList } from '../components/TagList'
import { PlatformPicker } from '../components/PlatformPicker'
import { FormatPicker } from '../components/FormatPicker'
import { StatusSheet } from '../components/StatusSheet'
import { ProgressRing } from '../components/ProgressRing'
import { SectionCard } from '../components/SectionCard'
import { GameDeals } from '../components/GameDeals'
import { GameThumb } from '../components/GameThumb'
import { TimeToBeat } from '../components/TimeToBeat'
import { Skeleton } from '../components/Skeleton'
import { PageContainer } from '../components/PageContainer'
import { showsDeals, statusColors, statusLabels } from '../lib/status'
import { haptic } from '../lib/haptics'
import { formatElapsed, useNow, useSessionTimer } from '../contexts/SessionTimerContext'
import { formatDate, sessionTimestamp, todayISO, unixToYear, yearToUnix } from '../lib/dates'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { Chip } from '../components/Chip'
import type { PlaySession } from '../types/game'
import type { Game } from '../types/game'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * La portada de IGDB se guarda en `t_cover_big` (264px de ancho), que a todo
 * el ancho del teléfono se ve borrosa. Para el hero se pide la versión 2x.
 */
function heroCover(url: string | null): string | null {
  if (!url || !url.includes('images.igdb.com')) return url
  return url.replace('/t_cover_big/', '/t_cover_big_2x/')
}

/**
 * Título, portada y año: sobre todo para juegos cargados a mano. Se guardan al
 * salir de cada campo (un título vacío o un año inválido no se guardan).
 */
function GameDataCard({ game, onSave }: { game: Game; onSave: (changes: Partial<Game>) => void }) {
  const [title, setTitle] = useState(game.title)
  const [cover, setCover] = useState(game.cover_url ?? '')
  const [year, setYear] = useState(unixToYear(game.first_release_date))

  return (
    <SectionCard icon={Pencil} title="Datos del juego">
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-lavender">Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const next = title.trim()
              if (!next) setTitle(game.title)
              else if (next !== game.title) onSave({ title: next })
            }}
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-[1fr_5.5rem] gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-lavender">Portada (URL)</span>
            <input
              type="url"
              inputMode="url"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              onBlur={() => {
                const next = cover.trim() || null
                if (next !== game.cover_url) onSave({ cover_url: next })
              }}
              placeholder="https://..."
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-lavender">Año</span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              onBlur={() => {
                const trimmed = year.trim()
                if (trimmed === unixToYear(game.first_release_date)) return
                if (!trimmed) onSave({ first_release_date: null })
                else if (yearToUnix(trimmed) != null) onSave({ first_release_date: yearToUnix(trimmed) })
                else setYear(unixToYear(game.first_release_date))
              }}
              placeholder="2024"
              className={inputClass}
            />
          </label>
        </div>
      </div>
    </SectionCard>
  )
}

/** Espera tras el último cambio antes de guardar (campos de texto, sliders). */
const AUTOSAVE_DELAY = 800

/** Duraciones rápidas para registrar una sesión sin teclear. */
const QUICK_MINUTES = [15, 30, 45, 60, 90, 120]

const MORE_DETAILS_KEY = 'shelflife_detail_more_open'

const inputClass =
  'w-full rounded-xl bg-background/40 px-3 py-2.5 text-sm text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-primary'

function readMoreDetailsPref() {
  try {
    return localStorage.getItem(MORE_DETAILS_KEY) === 'true'
  } catch {
    return false
  }
}

export function GameDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { games, loading, updateGame, deleteGame, refreshGame } = useGames()
  const { showToast, showError } = useToast()
  const confirm = useConfirm()
  const sessionTimer = useSessionTimer()
  const timerHere = sessionTimer.timer?.gameId === id ? sessionTimer.timer : null
  const now = useNow(timerHere != null)
  const game = games.find((g) => g.id === id)
  // Se pasa el id de la URL (no game?.id) para que estas consultas no
  // esperen a que termine de cargar toda la biblioteca antes de arrancar.
  const { sessions, addSession, deleteSession } = usePlaySessions(id)
  const { lists } = useLists()
  const { listIds, toggle: toggleList } = useGameListIds(id)

  // --- Guardado automático ---------------------------------------------
  // `draft` guarda SOLO los campos modificados que todavía no se guardaron.
  // Lo que se ve en pantalla es el juego del contexto con el draft encima.
  const [draft, setDraft] = useState<Partial<Game>>({})
  const draftRef = useRef<Partial<Game>>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inFlight = useRef<Promise<void> | null>(null)

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current)
    if (!id) return
    // Serializar: si hay un guardado en curso, esperarlo antes de mandar otro.
    if (inFlight.current) await inFlight.current
    const pending = draftRef.current
    if (Object.keys(pending).length === 0) return

    const run = (async () => {
      setSaveState('saving')
      try {
        await updateGame(id, pending)
        // Quitar del draft solo lo que no volvió a cambiar mientras se guardaba.
        const next = { ...draftRef.current }
        for (const key of Object.keys(pending) as (keyof Game)[]) {
          if (next[key] === pending[key]) delete next[key]
        }
        draftRef.current = next
        setDraft(next)
        setSaveState('saved')
      } catch (err) {
        setSaveState('error')
        showError(err, 'No se pudieron guardar los cambios')
      }
    })()
    inFlight.current = run
    await run
    inFlight.current = null
  }, [id, updateGame, showError])

  const setField = useCallback(
    (changes: Partial<Game>, { immediate = false } = {}) => {
      draftRef.current = { ...draftRef.current, ...changes }
      setDraft(draftRef.current)
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(flush, immediate ? 0 : AUTOSAVE_DELAY)
    },
    [flush]
  )

  // Guardar lo pendiente al salir de la pantalla o cuando la app pasa a
  // segundo plano (en mobile el sistema puede matar la PWA sin avisar).
  useEffect(() => {
    function onHide() {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  const [sessionMinutes, setSessionMinutes] = useState('')
  const [sessionDate, setSessionDate] = useState(todayISO())
  const [sessionError, setSessionError] = useState<string | null>(null)

  // Texto crudo del input de horas mientras se edita (null = mostrar el valor
  // del modelo). Sin esto, un input controlado de type="number" no deja borrar
  // el 0 ni escribir "7." como paso intermedio hacia "7.5".
  const [hoursText, setHoursText] = useState<string | null>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [editingProgress, setEditingProgress] = useState(false)
  const [editingHours, setEditingHours] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [moreOpen, setMoreOpen] = useState(readMoreDetailsPref)
  const notesRef = useRef<HTMLDivElement>(null)
  const closeStatusSheet = useCallback(() => setStatusOpen(false), [])

  function toggleMoreDetails() {
    setMoreOpen((open) => {
      try {
        localStorage.setItem(MORE_DETAILS_KEY, String(!open))
      } catch {
        /* preferencia no persistida: no pasa nada */
      }
      return !open
    })
  }

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

  const current = game ? { ...game, ...draft } : undefined
  const status = current?.status ?? 'pendiente'
  const storyPercent = current?.story_percent ?? 0
  const generalPercent = current?.general_percent ?? 0
  const completionistPercent = current?.completionist_percent ?? 0

  function goBack() {
    // Si se llegó navegando dentro de la app, volver atrás conserva los
    // filtros y el scroll de la pantalla anterior. Si se abrió por link
    // directo no hay historial propio: ir a la biblioteca.
    if (location.key !== 'default') navigate(-1)
    else navigate('/')
  }

  async function handleDelete() {
    if (!game) return
    setMenuOpen(false)
    const ok = await confirm({
      title: `¿Eliminar "${game.title}"?`,
      message:
        'Se borra de tu biblioteca junto con sus sesiones registradas y se quita de tus listas. No se puede deshacer.',
      confirmLabel: 'Eliminar juego',
      danger: true,
    })
    if (!ok) return
    try {
      clearTimeout(saveTimer.current)
      draftRef.current = {}
      await deleteGame(game.id)
      showToast(`"${game.title}" se eliminó de tu biblioteca`)
      navigate('/', { replace: true })
    } catch (err) {
      showError(err, 'No se pudo eliminar el juego')
    }
  }

  function toggleFavorite() {
    if (!current) return
    haptic()
    setField({ is_favorite: !current.is_favorite }, { immediate: true })
  }

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

  /** Registra una sesión; las horas las suma un trigger en la DB. */
  async function registerSession(minutes: number, playedAt: string, notes?: string | null) {
    if (!game) return
    // Mandar antes cualquier edición manual de horas pendiente, para que el
    // trigger sume sobre el valor correcto.
    await flush()
    await addSession(minutes, playedAt, notes ?? undefined)
    await refreshGame(game.id)
  }

  async function handleAddSession() {
    const minutes = Number(sessionMinutes)
    if (!minutes || minutes <= 0) {
      setSessionError('Ingresa una duración válida en minutos')
      return
    }
    setSessionError(null)
    try {
      await registerSession(minutes, sessionTimestamp(sessionDate))
      haptic()
      setSessionMinutes('')
      showToast(`Sesión de ${minutes} min registrada`)
    } catch (err) {
      showError(err, 'Error al guardar la sesión')
    }
  }

  async function handleStartTimer() {
    if (!game) return
    const other = sessionTimer.timer
    if (other && other.gameId !== game.id) {
      const ok = await confirm({
        title: 'Ya hay un cronómetro corriendo',
        message: `Se está midiendo una sesión de ${other.title}. ¿Detenerla (se guarda) y empezar con este juego?`,
        confirmLabel: 'Detener y empezar',
      })
      if (!ok) return
      const stopped = sessionTimer.stop()
      if (stopped) {
        // La sesión es de otro juego: se inserta directo con su game_id.
        await addSessionFor(stopped.gameId, stopped.minutes, stopped.startedAt)
      }
    }
    sessionTimer.start(game.id, game.title)
    haptic()
    // Empezar a jugar un juego pendiente lo pasa a "Jugando".
    if (current && (current.status === 'pendiente' || current.status === 'en_pausa')) {
      handleStatusChange('jugando')
    }
  }

  async function handleStopTimer() {
    const stopped = sessionTimer.stop()
    if (!stopped) return
    haptic([10, 40, 10])
    try {
      await registerSession(stopped.minutes, new Date(stopped.startedAt).toISOString())
      showToast(`Sesión de ${stopped.minutes} min registrada`)
    } catch (err) {
      showError(err, 'Error al guardar la sesión')
    }
  }

  async function handleCancelTimer() {
    const ok = await confirm({
      title: '¿Descartar el cronómetro?',
      message: 'El tiempo medido no se va a guardar.',
      confirmLabel: 'Descartar',
      danger: true,
    })
    if (ok) sessionTimer.cancel()
  }

  /** Sesión para un juego distinto al que se está viendo. */
  async function addSessionFor(gameId: string, minutes: number, startedAt: number) {
    try {
      const { error } = await supabase.from('activity_log').insert({
        item_id: gameId,
        duration_minutes: minutes,
        occurred_at: new Date(startedAt).toISOString(),
      })
      if (error) throw error
      await refreshGame(gameId)
      showToast(`Sesión de ${minutes} min guardada`)
    } catch (err) {
      showError(err, 'No se pudo guardar la sesión anterior')
    }
  }

  async function handleDeleteSession(session: PlaySession) {
    if (!game) return
    try {
      await flush()
      await deleteSession(session.id)
      await refreshGame(game.id)
      showToast(`Sesión de ${session.duration_minutes} min eliminada`, {
        duration: 5000,
        action: {
          label: 'Deshacer',
          onClick: () => {
            // Se vuelve a insertar (el trigger vuelve a sumar las horas).
            registerSession(session.duration_minutes, session.played_at, session.notes).catch(
              (err) => showError(err, 'No se pudo restaurar la sesión')
            )
          },
        },
      })
    } catch (err) {
      showError(err, 'No se pudo eliminar la sesión')
    }
  }

  async function handleToggleList(listId: string) {
    try {
      await toggleList(listId)
    } catch (err) {
      showError(err, 'No se pudo actualizar la lista')
    }
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
        <button onClick={() => navigate('/')} className="mt-4 text-accent">
          Volver a la biblioteca
        </button>
      </PageContainer>
    )
  }

  return (
    <>
      <div className="relative h-64 w-full overflow-hidden bg-primary-dark/20 md:h-80">
        <GameThumb
          src={heroCover(game.cover_url)}
          fallbacks={game.cover_url ? [game.cover_url] : []}
          alt={game.title}
          eager
          className="h-full w-full object-cover"
          placeholderClassName="text-5xl"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, var(--color-background) 0%, transparent 55%)',
          }}
        />

        {/* Botones sobre la portada: respetan el notch / isla dinámica. */}
        <div
          className="absolute inset-x-4 flex items-start justify-between"
          style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
        >
          <button
            onClick={goBack}
            aria-label="Volver"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-background/70 text-ink backdrop-blur"
          >
            <X size={20} />
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Más opciones"
              aria-expanded={menuOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-background/70 text-ink backdrop-blur"
            >
              <MoreVertical size={20} />
            </button>
            {menuOpen && (
              <>
                {/* Capa invisible: tocar fuera cierra el menú. */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl bg-background-surface p-1 shadow-lg ring-1 ring-primary-dark/30">
                  <button
                    onClick={handleDelete}
                    className="w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-error active:bg-error/10"
                  >
                    Eliminar juego
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
            <SectionCard
              icon={ListChecks}
              title="Progreso"
              action={
                <button
                  onClick={() => setEditingProgress((v) => !v)}
                  aria-label="Editar progreso"
                  aria-expanded={editingProgress}
                  className="-m-2 flex h-11 w-11 items-center justify-center rounded-full text-lavender active:bg-primary-dark/20"
                >
                  <Pencil size={16} />
                </button>
              }
            >
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-background/40 p-3">
                <ProgressRing icon={BookOpen} label="Historia" percent={storyPercent} />
                <ProgressRing icon={ListChecks} label="General" percent={generalPercent} />
                <ProgressRing icon={Trophy} label="100%" percent={completionistPercent} />
              </div>

              {editingProgress && (
                <div className="mt-3 flex flex-col gap-3">
                  {(
                    [
                      ['story_percent', 'Historia', storyPercent],
                      ['general_percent', 'General', generalPercent],
                      ['completionist_percent', '100%', completionistPercent],
                    ] as const
                  ).map(([key, label, value]) => (
                    <label key={key} className="block">
                      <div className="mb-1 flex items-center justify-between text-xs text-lavender">
                        <span>{label}</span>
                        <span>{value}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={value}
                        onChange={(e) => setField({ [key]: Number(e.target.value) })}
                        className="h-8 w-full accent-accent"
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between rounded-xl bg-background/40 p-3">
                <div>
                  <p className="text-2xl font-bold text-ink">{current.hours_played}</p>
                  <p className="text-xs text-lavender">horas jugadas</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingHours((v) => !v)}
                    aria-label="Editar horas"
                    aria-expanded={editingHours}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-dark/20 text-lavender"
                  >
                    <Pencil size={16} />
                  </button>
                  {!timerHere && (
                    <button
                      onClick={handleStartTimer}
                      className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-primary-darker active:scale-95"
                    >
                      <Play size={14} fill="currentColor" /> Jugar
                    </button>
                  )}
                </div>
              </div>

              {timerHere && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-accent/15 p-3 ring-1 ring-accent/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-lavender">Sesión en curso</p>
                    <p className="text-2xl font-bold tabular-nums text-ink" aria-live="off">
                      {formatElapsed(now - timerHere.startedAt)}
                    </p>
                  </div>
                  <button
                    onClick={handleCancelTimer}
                    aria-label="Descartar cronómetro"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-lavender active:bg-primary-dark/20"
                  >
                    <X size={18} />
                  </button>
                  <button
                    onClick={handleStopTimer}
                    className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-primary-darker active:scale-95"
                  >
                    <Square size={14} fill="currentColor" /> Terminar
                  </button>
                </div>
              )}
              {editingHours && (
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  aria-label="Horas jugadas"
                  value={hoursText ?? String(current.hours_played ?? 0)}
                  onChange={(e) => {
                    const raw = e.target.value
                    setHoursText(raw)
                    const parsed = raw === '' ? 0 : Number(raw)
                    if (!Number.isNaN(parsed)) {
                      setField({ hours_played: parsed })
                    }
                  }}
                  onBlur={() => setHoursText(null)}
                  className={`mt-2 ${inputClass}`}
                />
              )}

              <div className="mt-3">
                <StarRating
                  value={current.rating ?? null}
                  onChange={(rating) => setField({ rating }, { immediate: true })}
                />
              </div>
            </SectionCard>

            <SectionCard icon={Clock} title="Sesiones de juego">
              <div className="mb-3 flex flex-col gap-3">
                <div className="flex flex-wrap gap-x-2 gap-y-3">
                  {QUICK_MINUTES.map((m) => (
                    <Chip
                      key={m}
                      active={sessionMinutes === String(m)}
                      onClick={() => setSessionMinutes(String(m))}
                      inactiveClassName="bg-background/40 text-lavender ring-1 ring-primary-dark/30"
                    >
                      {m < 60 ? `${m} min` : `${m / 60} h`}
                    </Chip>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    placeholder="Minutos"
                    aria-label="Minutos jugados"
                    value={sessionMinutes}
                    onChange={(e) => setSessionMinutes(e.target.value)}
                    className={`min-w-0 ${inputClass}`}
                  />
                  <input
                    type="date"
                    aria-label="Fecha de la sesión"
                    value={sessionDate}
                    max={todayISO()}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className={`min-w-0 ${inputClass}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddSession}
                  disabled={!sessionMinutes}
                  className="min-h-11 rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-40"
                >
                  Registrar sesión
                </button>
              </div>
              {sessionError && <p className="mb-2 text-sm text-error">{sessionError}</p>}

              {sessions.length === 0 ? (
                <p className="text-sm text-lavender">Todavía no registraste sesiones.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {sessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-xl bg-background/40 py-1 pl-3 pr-1 text-sm ring-1 ring-primary-dark/30"
                    >
                      <span className="text-lavender">
                        {formatDate(s.played_at)} — {s.duration_minutes} min
                      </span>
                      <button
                        onClick={() => handleDeleteSession(s)}
                        aria-label={`Eliminar sesión de ${s.duration_minutes} min`}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-lavender active:bg-error/10 active:text-error"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Estas dos secciones incluyen su propia tarjeta y no se muestran
                si no hay datos (juego de consola sin precios, IGDB sin tiempos). */}
            {showsDeals(status) && (
              <GameDeals title={game.title} steamAppId={game.steam_appid} />
            )}

            <TimeToBeat igdbId={game.igdb_id} title={game.title} />

            <div ref={notesRef} className="scroll-mt-20">
              <SectionCard icon={StickyNote} title="Notas y reseña">
                <div className="flex flex-col gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-lavender">Notas</span>
                    <textarea
                      value={current.notes ?? ''}
                      onChange={(e) => setField({ notes: e.target.value })}
                      rows={3}
                      placeholder="Notas de progreso, spoilers, pendientes..."
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-lavender">Reseña</span>
                    <textarea
                      value={current.review ?? ''}
                      onChange={(e) => setField({ review: e.target.value })}
                      rows={4}
                      placeholder="Tu opinión sobre el juego..."
                      className={inputClass}
                    />
                  </label>
                </div>
              </SectionCard>
            </div>

            <SectionCard icon={ClipboardList} title="Mis listas">
              {lists.length === 0 ? (
                <p className="text-sm text-lavender">
                  No tienes listas todavía. Crea una desde la pestaña "Listas".
                </p>
              ) : (
                <div className="flex flex-wrap gap-x-2 gap-y-3">
                  {lists.map((list) => {
                    const active = listIds.has(list.id)
                    return (
                      <Chip
                        key={list.id}
                        active={active}
                        onClick={() => handleToggleList(list.id)}
                        inactiveClassName="bg-background/40 text-lavender ring-1 ring-primary-dark/30"
                      >
                        {active ? (
                          <Check size={14} className="-ml-0.5 mr-1" />
                        ) : (
                          <Plus size={14} className="-ml-0.5 mr-1" />
                        )}
                        {list.name}
                      </Chip>
                    )
                  })}
                </div>
              )}
            </SectionCard>

            {game.summary && (
              <SectionCard icon={Info} title="Acerca de">
                <p className={`text-sm text-lavender ${!descExpanded ? 'line-clamp-4' : ''}`}>
                  {game.summary}
                </p>
                <button
                  onClick={() => setDescExpanded((v) => !v)}
                  className="-mx-2 mt-1 min-h-11 rounded-lg px-2 text-sm font-medium text-accent"
                >
                  {descExpanded ? 'Leer menos' : 'Leer más'}
                </button>
              </SectionCard>
            )}

            {/* Campos que se tocan poco: agrupados y plegados para que la
                pantalla no sea un scroll interminable en el teléfono. */}
            <button
              type="button"
              onClick={toggleMoreDetails}
              aria-expanded={moreOpen}
              className="flex min-h-12 items-center justify-between rounded-2xl bg-background-surface px-4 text-sm font-semibold text-ink ring-1 ring-primary-dark/20"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-lavender" />
                Más detalles
                <span className="font-normal text-lavender">
                  · datos, plataforma, fechas…
                </span>
              </span>
              <ChevronDown
                size={18}
                className={`text-lavender transition-transform ${moreOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {moreOpen && (
              <>
                <GameDataCard
                  game={current}
                  onSave={(changes) => setField(changes, { immediate: true })}
                />

                <SectionCard icon={Gamepad2} title="Plataforma">
                  <PlatformPicker
                    value={current.platform}
                    onChange={(platform) => setField({ platform })}
                  />
                </SectionCard>

                <SectionCard icon={Calendar} title="Fechas">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-lavender">Inicio</span>
                      <input
                        type="date"
                        value={current.date_started ?? ''}
                        onChange={(e) => setField({ date_started: e.target.value || null })}
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-lavender">Fin</span>
                      <input
                        type="date"
                        value={current.date_finished ?? ''}
                        onChange={(e) => setField({ date_finished: e.target.value || null })}
                        className={inputClass}
                      />
                    </label>
                  </div>
                </SectionCard>

                <SectionCard icon={Disc} title="Formato">
                  <FormatPicker
                    value={current.format}
                    onChange={(format) => setField({ format })}
                  />
                </SectionCard>

                <SectionCard icon={Tag} title="Etiquetas">
                  <div className="mb-2">
                    <TagList value={current.genre} />
                  </div>
                  <input
                    value={current.genre ?? ''}
                    onChange={(e) => setField({ genre: e.target.value })}
                    placeholder="Separa varios con coma"
                    aria-label="Etiquetas"
                    className={inputClass}
                  />
                </SectionCard>

                <SectionCard icon={Layers} title="Franquicia">
                  <input
                    value={current.franchise ?? ''}
                    onChange={(e) => setField({ franchise: e.target.value })}
                    placeholder="Ej. Final Fantasy"
                    aria-label="Franquicia"
                    className={inputClass}
                  />
                </SectionCard>

                <SectionCard icon={Repeat} title="Replays">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setField({ replays: Math.max(0, (current.replays ?? 0) - 1) })
                      }
                      aria-label="Restar un replay"
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-dark/20 text-lavender"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center text-lg font-semibold text-ink" aria-live="polite">
                      {current.replays ?? 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => setField({ replays: (current.replays ?? 0) + 1 })}
                      aria-label="Sumar un replay"
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-dark/20 text-lavender"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </SectionCard>
              </>
            )}
          </div>
        </div>
      </PageContainer>
    </>
  )
}


function SaveIndicator({
  state,
  onRetry,
  compact = false,
}: {
  state: SaveState
  onRetry: () => void
  /** Versión para la cabecera compacta: solo ícono. */
  compact?: boolean
}) {
  if (state === 'idle') return null
  if (compact) {
    if (state === 'error') {
      return (
        <button onClick={onRetry} aria-label="Reintentar guardado" className="flex h-11 w-9 items-center justify-center text-error">
          <AlertCircle size={16} />
        </button>
      )
    }
    return state === 'saving' ? (
      <Loader2 size={16} className="flex-shrink-0 animate-spin text-lavender" aria-label="Guardando" />
    ) : (
      <CheckCircle2 size={16} className="flex-shrink-0 text-accent" aria-label="Guardado" />
    )
  }
  if (state === 'error') {
    return (
      <button
        onClick={onRetry}
        className="mt-1.5 flex flex-shrink-0 items-center gap-1 text-xs font-medium text-error"
      >
        <AlertCircle size={14} /> Reintentar
      </button>
    )
  }
  return (
    <span
      aria-live="polite"
      className="mt-1.5 flex flex-shrink-0 items-center gap-1 text-xs text-lavender"
    >
      {state === 'saving' ? (
        <>
          <Loader2 size={14} className="animate-spin" /> Guardando
        </>
      ) : (
        <>
          <CheckCircle2 size={14} className="text-accent" /> Guardado
        </>
      )}
    </span>
  )
}

function CompactHeader({
  visible,
  title,
  isFavorite,
  saveState,
  onBack,
  onRetry,
  onToggleFavorite,
}: {
  visible: boolean
  title: string
  isFavorite: boolean
  saveState: SaveState
  onBack: () => void
  onRetry: () => void
  onToggleFavorite: () => void
}) {
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 top-0 z-30 border-b border-primary-dark/30 bg-background/90 backdrop-blur transition-transform duration-200 ${
        visible ? 'translate-y-0' : 'pointer-events-none -translate-y-full'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-2">
        <button
          onClick={onBack}
          aria-label="Volver"
          tabIndex={visible ? 0 : -1}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink active:bg-primary-dark/20"
        >
          <ArrowLeft size={20} />
        </button>
        <p className="min-w-0 flex-1 truncate font-semibold text-ink">{title}</p>
        <SaveIndicator state={saveState} onRetry={onRetry} compact />
        <button
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
          tabIndex={visible ? 0 : -1}
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full active:bg-primary-dark/20 ${
            isFavorite ? 'text-accent' : 'text-lavender'
          }`}
        >
          <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  )
}
