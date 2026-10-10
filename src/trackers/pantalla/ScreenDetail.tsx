import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Eye,
  Heart,
  Minus,
  MonitorPlay,
  MoreVertical,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  StickyNote,
} from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { PageContainer } from '../../components/PageContainer'
import { GameThumb } from '../../components/GameThumb'
import { SectionCard } from '../../components/SectionCard'
import { StarRating } from '../../components/StarRating'
import { ItemStatusSheet } from '../../components/ItemStatusSheet'
import { BottomSheet } from '../../components/BottomSheet'
import { BlurTextarea } from '../../components/BlurTextarea'
import { MediaForm } from '../../components/MediaForm'
import { Synopsis } from '../../components/Synopsis'
import { ListPicker } from '../../components/ListPicker'
import { CoverPicker } from '../../components/CoverPicker'
import { FormatPicker } from '../../components/FormatPicker'
import { SCREEN_PLATFORMS } from '../../lib/formats'
import { haptic } from '../../lib/haptics'
import { sizedCover } from '../../lib/images'
import { todayISO } from '../../lib/dates'
import {
  coverOptions,
  formatMinutes,
  itemStatusColor,
  mediaSections,
  mediaTypeIcons,
  mediaTypeLabels,
  episodeLabel,
  getMediaDetails,
  progressChanges,
  progressKind,
  itemSeasons,
  seasonEpisode,
  statusChanges,
} from '../../lib/media'
import type { Item, ItemStatus, ItemWrite, MediaSearchResult, ScreenType } from '../../types/item'
import { NextSeason } from './NextSeason'

const section = mediaSections.pantalla

/** Hasta cuántos episodios se dibujan como casillas (más, solo el contador). */
const MAX_EPISODE_GRID = 120

const inputClass =
  'w-full rounded-xl bg-background/40 px-3 py-2.5 text-sm text-ink ring-1 ring-primary-dark/40 focus:outline-none focus:ring-2 focus:ring-accent'

const isScreenType = (type: string): type is ScreenType =>
  (section.types as string[]).includes(type)

interface EpisodeGridProps {
  /** Número de corrido del primer episodio de la grilla. */
  from: number
  count: number
  progress: number
  onSetProgress: (episode: number) => void
}

/**
 * Una casilla por episodio. Tocar una marca todo hasta ahí; tocar el último
 * visto lo desmarca. Muestra el número dentro de la temporada.
 */
function EpisodeGrid({ from, count, progress, onSetProgress }: EpisodeGridProps) {
  return (
    <div className="mt-3 grid grid-cols-8 gap-1.5 sm:grid-cols-10" role="group" aria-label="Episodios vistos">
      {Array.from({ length: count }, (_, i) => i).map((i) => {
        const ep = from + i
        const seen = ep <= progress
        return (
          <button
            key={ep}
            type="button"
            onClick={() => onSetProgress(ep === progress ? ep - 1 : ep)}
            aria-label={`Episodio ${i + 1}${seen ? ', visto' : ''}`}
            aria-pressed={seen}
            className={`flex aspect-square items-center justify-center rounded-lg text-xs font-semibold tabular-nums transition-colors ${
              seen
                ? 'bg-accent text-primary-darker'
                : 'bg-background/40 text-lavender ring-1 ring-primary-dark/40 active:bg-primary-dark/40'
            }`}
          >
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}

/** Temporadas plegables: se abre la que estás viendo; cada una con su avance. */
function SeasonList({
  item,
  seasons,
  onSetProgress,
}: {
  item: Item
  seasons: number[]
  onSetProgress: (episode: number) => void
}) {
  // La temporada del próximo episodio (o la última, si ya está todo visto).
  const next = seasonEpisode(Math.min(item.progress + 1, seasons.reduce((a, b) => a + b, 0)), seasons)
  const [open, setOpen] = useState<number | null>(next?.season ?? 1)
  // Número de corrido del primer episodio de cada temporada.
  const starts = seasons.map((_, i) => 1 + seasons.slice(0, i).reduce((a, b) => a + b, 0))

  return (
    <div className="mt-4 flex flex-col divide-y divide-primary-dark/30 overflow-hidden rounded-xl ring-1 ring-primary-dark/40">
      {seasons.map((count, i) => {
        const season = i + 1
        const from = starts[i]
        const seen = Math.max(0, Math.min(count, item.progress - from + 1))
        const isOpen = open === season
        return (
          <div key={season}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : season)}
              aria-expanded={isOpen}
              className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left active:bg-primary-dark/20"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                {seen === count && <Check size={14} className="text-accent" />}
                Temporada {season}
              </span>
              <span className="flex items-center gap-1 text-xs tabular-nums text-lavender">
                {seen}/{count}
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3">
                <EpisodeGrid
                  from={from}
                  count={count}
                  progress={item.progress}
                 
                  onSetProgress={onSetProgress}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Anotar el episodio a mano: para saltar lejos (series largas, o algo que
 * ya venías viendo) sin tocar +1 mil veces. Por defecto no suma tiempo de
 * hoy; "Lo vi hoy" lo registra como visto ahora.
 */
function ManualEpisode({
  item,
  seasons,
  onSave,
}: {
  item: Item
  seasons: number[] | undefined
  onSave: (episode: number, count?: boolean) => void
}) {
  const [value, setValue] = useState('')
  const [today, setToday] = useState(false)
  const total = item.progress_total
  const n = Number(value)
  const valid = value !== '' && Number.isInteger(n) && n >= 0 && (total == null || n <= total) && n !== item.progress
  const se = valid ? seasonEpisode(n, seasons) : null

  return (
    <form
      className="mt-4 rounded-xl bg-background/40 p-3 ring-1 ring-primary-dark/40"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave(n, today && n > item.progress)
        setValue('')
        setToday(false)
      }}
    >
      <div className="flex items-end gap-2">
        <label className="block flex-1">
          <span className="mb-1 block text-xs text-lavender">Voy en el episodio</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={total ?? undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={String(item.progress)}
            className="w-full rounded-lg bg-background/60 px-3 py-2 text-ink ring-1 ring-primary-dark/40 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <button
          type="submit"
          disabled={!valid}
          className="min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-primary-darker disabled:opacity-40"
        >
          Guardar
        </button>
      </div>
      {se && (
        <p className="mt-1 text-xs text-lavender">
          = Temporada {se.season}, episodio {se.episode}
        </p>
      )}
      {valid && n > item.progress && (
        <label className="mt-2 flex min-h-9 items-center gap-2 text-xs text-lavender">
          <input
            type="checkbox"
            checked={today}
            onChange={(e) => setToday(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Los vi hoy (suma {n - item.progress === 1 ? 'el episodio' : `los ${n - item.progress} episodios`} a mi
          tiempo e historial)
        </label>
      )}
    </form>
  )
}

interface EpisodesProps {
  item: Item
  /** `count` = registrar lo visto con su tiempo (falso al anotarlo a mano). */
  onSetProgress: (episode: number, count?: boolean) => void
  onSaveTotal: (total: number | null) => void
}

/**
 * Episodios de una serie o anime: contador, lo que falta y una casilla por
 * episodio. Tocar una casilla marca todo hasta ahí; tocar el último visto lo
 * desmarca.
 */
function Episodes({ item, onSetProgress, onSaveTotal }: EpisodesProps) {
  const total = item.progress_total
  const runtime = item.metadata.runtime_minutes
  const left = total != null ? Math.max(0, total - item.progress) : null
  const pct = total ? Math.min(100, (item.progress / total) * 100) : null
  // Con temporadas (y si cuadran con el total), el avance se lee "T2 · E5".
  const seasons = itemSeasons(item)
  const current = seasonEpisode(item.progress, seasons)

  return (
    <SectionCard
      icon={Play}
      title="Episodios"
      action={
        left != null && left > 0 ? (
          <span className="text-xs text-lavender">
            {left === 1 ? 'Queda 1' : `Quedan ${left}`}
            {runtime ? ` · ~${formatMinutes(left * runtime)}` : ''}
          </span>
        ) : null
      }
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onSetProgress(item.progress - 1)}
          disabled={item.progress === 0}
          aria-label="Quitar un episodio"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-background/40 text-lavender ring-1 ring-primary-dark/40 disabled:opacity-40"
        >
          <Minus size={20} />
        </button>
        {current ? (
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums text-ink">
              T{current.season} · E{current.episode}
            </p>
            <p className="text-xs text-lavender">
              {item.progress} de {total ?? '?'} episodios
            </p>
          </div>
        ) : (
          <p className="text-center text-3xl font-bold tabular-nums text-ink">
            {item.progress}
            <span className="text-lg font-normal text-lavender"> / {total ?? '?'}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => onSetProgress(item.progress + 1)}
          disabled={total != null && item.progress >= total}
          aria-label="Sumar un episodio"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary-darker disabled:opacity-40"
        >
          <Plus size={22} />
        </button>
      </div>

      {pct != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary-dark/40">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {seasons ? (
        <SeasonList item={item} seasons={seasons} onSetProgress={onSetProgress} />
      ) : (
        total != null &&
        total <= MAX_EPISODE_GRID && (
          <EpisodeGrid from={1} count={total} progress={item.progress} onSetProgress={onSetProgress} />
        )
      )}

      <ManualEpisode item={item} seasons={seasons} onSave={onSetProgress} />

      <label className="mt-4 flex items-center justify-between gap-3 text-sm text-lavender">
        Total de episodios
        <input
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={total ?? ''}
          key={total ?? 'none'}
          onBlur={(e) => {
            const n = Number(e.target.value)
            const next = Number.isInteger(n) && n > 0 ? n : null
            if (next !== total) onSaveTotal(next)
          }}
          className="w-20 rounded-lg bg-background/40 px-2 py-1.5 text-right text-ink ring-1 ring-primary-dark/40 focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
    </SectionCard>
  )
}

/** Series de TMDB guardadas antes de que existieran las temporadas: se completan una vez al abrirlas. */
const seasonsTried = new Set<string>()

function useFillSeasons(item: Item | undefined, updateItem: (id: string, changes: ItemWrite) => Promise<Item>) {
  useEffect(() => {
    if (
      !item ||
      item.media_type !== 'series' ||
      item.source !== 'tmdb' ||
      !item.external_id ||
      item.metadata.seasons?.length ||
      seasonsTried.has(item.id)
    ) {
      return
    }
    seasonsTried.add(item.id)
    getMediaDetails({ source: 'tmdb', external_id: item.external_id, media_type: 'series' } as MediaSearchResult)
      .then((d) => {
        const seasons = d.seasons
        if (!seasons?.length) return
        const total = seasons.reduce((a, b) => a + b, 0)
        if (total < item.progress) return
        return updateItem(item.id, {
          metadata: { ...item.metadata, seasons },
          progress_total: total,
        })
      })
      .catch(() => {
        /* sin temporadas: se sigue contando de corrido */
      })
  }, [item, updateItem])
}

/**
 * Detalle de una película, serie o anime, con diseño de app de streaming:
 * póster sobre su propio fondo difuminado, una acción principal (ver el
 * siguiente episodio, marcar vista) y los episodios como casillas.
 */
export function ScreenDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { items, loading, updateItem, deleteItem, logActivity } = useMedia()
  const { showToast, showError } = useToast()
  const confirm = useConfirm()

  const item = items.find((i) => i.id === id)
  useFillSeasons(item, updateItem)
  const [statusOpen, setStatusOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [coverOpen, setCoverOpen] = useState(false)

  function goBack() {
    if (location.key !== 'default') navigate(-1)
    else navigate(section.libraryPath)
  }

  if (!item || !isScreenType(item.media_type)) {
    return (
      <PageContainer>
        <p className="text-sm text-lavender">{loading ? 'Cargando...' : 'No se encontró.'}</p>
        {!loading && (
          <button onClick={() => navigate(section.libraryPath)} className="mt-4 min-h-11 text-accent">
            Volver a {section.title}
          </button>
        )}
      </PageContainer>
    )
  }

  const current: Item = item
  const type = item.media_type
  const TypeIcon = mediaTypeIcons[type]
  const isMovie = progressKind(type) === 'none'
  const runtime = current.metadata.runtime_minutes ?? null
  const total = current.progress_total
  const finishedSeries = !isMovie && total != null && current.progress >= total

  async function save(changes: ItemWrite, message?: string) {
    try {
      await updateItem(current.id, changes)
      if (message) showToast(message)
    } catch (err) {
      showError(err, 'No se pudo guardar')
    }
  }

  async function handleStatus(status: ItemStatus) {
    setStatusOpen(false)
    if (status === current.status) return
    haptic()
    await save(statusChanges(current, status, todayISO()))
  }

  /**
   * Lleva el avance a `episode`. Avanzar con `count` registra lo visto
   * (episodios y su tiempo); sin `count` (anotarlo a mano, ej. saltar al
   * 1085 de One Piece) solo mueve el avance, sin sumar tiempo de hoy.
   * Retroceder es una corrección y no descuenta nada. Es optimista.
   */
  async function setProgress(episode: number, count = true) {
    const next = Math.max(0, total != null ? Math.min(total, episode) : episode)
    if (next === current.progress) return
    haptic()
    try {
      if (next > current.progress) {
        const delta = next - current.progress
        const changes = progressChanges(current, next, todayISO())
        const pending = count
          ? logActivity(current.id, { duration_minutes: runtime ? runtime * delta : null, progress_delta: delta }, changes)
          : updateItem(current.id, changes)
        if (changes.status === 'completed' && current.status !== 'completed') {
          showToast(`¡Terminaste ${current.title}!`)
        } else if (!count) {
          showToast(`${current.title}: ${episodeLabel(next, itemSeasons(current))}`)
        }
        await pending
      } else {
        await updateItem(current.id, { progress: next })
      }
    } catch (err) {
      showError(err, 'No se pudo guardar el avance')
    }
  }

  /** Película vista (o vuelta a ver). */
  async function markWatched() {
    haptic()
    const rewatch = current.status === 'completed'
    const changes: ItemWrite = rewatch
      ? { replays: current.replays + 1 }
      : statusChanges(current, 'completed', todayISO())
    const pending = logActivity(current.id, { duration_minutes: runtime }, changes)
    showToast(rewatch ? `Volviste a ver ${current.title}` : `${current.title}: vista`)
    try {
      await pending
    } catch (err) {
      showError(err, 'No se pudo guardar')
    }
  }

  /** Serie terminada: empezar a verla de nuevo desde el episodio 1. */
  async function rewatchSeries() {
    haptic()
    await save(
      { progress: 0, status: 'in_progress', replays: current.replays + 1 },
      `Empezaste de nuevo ${current.title}`
    )
  }

  async function handleDelete() {
    setMenuOpen(false)
    const ok = await confirm({
      title: `¿Eliminar ${current.title}?`,
      message: 'Se borra de tu biblioteca junto con su historial.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteItem(current.id)
      showToast(`${current.title} eliminado`)
      navigate(section.libraryPath, { replace: true })
    } catch (err) {
      showError(err, 'No se pudo eliminar')
    }
  }

  const year = current.release_date?.slice(0, 4)
  const facts = [
    current.format,
    year,
    isMovie
      ? runtime && formatMinutes(runtime)
      : [total && `${total} episodios`, runtime && `${runtime} min c/u`].filter(Boolean).join(' · '),
  ].filter(Boolean)

  // Acción principal según el tipo y el avance.
  const primary = isMovie
    ? {
        label: current.status === 'completed' ? 'La volví a ver' : 'Marcar como vista',
        Icon: current.status === 'completed' ? Repeat : Eye,
        onClick: markWatched,
      }
    : finishedSeries
      ? { label: 'Volver a verla', Icon: RotateCcw, onClick: rewatchSeries }
      : {
          label: `Ver ${episodeLabel(current.progress + 1, itemSeasons(current)).replace('Ep.', 'episodio')}`,
          Icon: Play,
          onClick: () => setProgress(current.progress + 1),
        }

  return (
    <>
      {/* Portada: el póster a la izquierda sobre su propio fondo difuminado,
          como la cabecera de las apps de streaming. */}
      <div
        className="relative w-full overflow-hidden"
        style={{ paddingTop: 'calc(4.5rem + env(safe-area-inset-top))' }}
      >
        {current.cover_url && (
          <img
            src={sizedCover(current.cover_url, 'thumb') ?? undefined}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-2xl"
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, var(--color-background) 10%, transparent 90%)' }}
        />

        <div className="relative mx-auto flex max-w-md items-end gap-4 px-4 pb-2 md:max-w-xl">
          <button
            type="button"
            onClick={() => setCoverOpen(true)}
            aria-label="Cambiar portada"
            className="block transition-transform active:scale-[0.98] aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-xl bg-primary-dark/30 shadow-2xl shadow-black/60 ring-1 ring-white/10 md:w-40"
          >
            <GameThumb
              src={current.cover_url}
              alt={current.title}
              eager
              className="h-full w-full object-cover"
              placeholderClassName="text-5xl"
              icon={TypeIcon}
            />
          </button>
          <div className="min-w-0 pb-1">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
              <TypeIcon size={13} /> {mediaTypeLabels[type]}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold leading-tight text-ink">{current.title}</h1>
            {current.metadata.original_title && (
              <p className="mt-0.5 text-xs italic text-lavender">{current.metadata.original_title}</p>
            )}
            {facts.length > 0 && <p className="mt-1 text-sm text-lavender">{facts.join(' · ')}</p>}
          </div>
        </div>

        {/* Volver y menú (editar, eliminar). */}
        <div
          className="absolute inset-x-4 flex items-start justify-between"
          style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
        >
          <button
            onClick={goBack}
            aria-label="Volver"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-background/70 text-ink backdrop-blur"
          >
            <ArrowLeft size={20} />
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
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl bg-background-surface p-1 shadow-lg ring-1 ring-primary-dark/40">
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      setEditOpen(true)
                    }}
                    className="w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-ink active:bg-primary-dark/30"
                  >
                    Editar datos
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      setCoverOpen(true)
                    }}
                    className="w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-ink active:bg-primary-dark/30"
                  >
                    Cambiar portada
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-error active:bg-error/10"
                  >
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <PageContainer belowHero>
        <div className="mx-auto md:max-w-xl">
          {current.genres.length > 0 && (
            <div className="scrollbar-hide -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4">
              {current.genres.map((g) => (
                <span
                  key={g}
                  className="shrink-0 rounded-full bg-background-surface px-3 py-1 text-xs text-lavender ring-1 ring-primary-dark/40"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Acción principal, estado y favorito. */}
          <button
            type="button"
            onClick={primary.onClick}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-primary-darker transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <primary.Icon size={18} fill={primary.Icon === Play ? 'currentColor' : 'none'} />
            {primary.label}
          </button>
          <div className="mb-5 mt-2 flex items-center gap-2">
            <button
              onClick={() => setStatusOpen(true)}
              className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-medium ${itemStatusColor(current.status, section)}`}
            >
              {current.status === 'completed' && <Check size={15} />}
              {section.statusLabels[current.status]}
              <ChevronDown size={14} />
            </button>
            <button
              onClick={() => save({ is_favorite: !current.is_favorite })}
              aria-label={current.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
              aria-pressed={current.is_favorite}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-primary-dark/40 ${
                current.is_favorite ? 'bg-accent text-primary-darker' : 'bg-background-surface text-lavender'
              }`}
            >
              <Heart size={18} fill={current.is_favorite ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {current.summary && <Synopsis text={current.summary} />}

            {/* Anime de AniList terminado: la temporada siguiente es otra entrada. */}
            {type === 'anime' &&
              current.source === 'anilist' &&
              current.external_id &&
              (current.status === 'completed' || finishedSeries) && <NextSeason item={current} />}

            {!isMovie && (
              <Episodes
                item={current}
               
                onSetProgress={setProgress}
                onSaveTotal={(progress_total) => save({ progress_total })}
              />
            )}

            <SectionCard icon={Clock} title="Mi registro">
              <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-lavender">Tiempo visto</p>
                  <p className="font-semibold text-ink">
                    {current.time_spent_minutes > 0 ? formatMinutes(current.time_spent_minutes) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-lavender">Veces vista de nuevo</p>
                  <p className="font-semibold text-ink">{current.replays}</p>
                </div>
              </div>
              <StarRating value={current.rating} onChange={(rating) => save({ rating })} />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 flex items-center gap-1 text-xs text-lavender">
                    <Calendar size={12} /> Empecé
                  </span>
                  <input
                    type="date"
                    value={current.date_started ?? ''}
                    onChange={(e) => save({ date_started: e.target.value || null })}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 flex items-center gap-1 text-xs text-lavender">
                    <Calendar size={12} /> Terminé
                  </span>
                  <input
                    type="date"
                    value={current.date_finished ?? ''}
                    onChange={(e) => save({ date_finished: e.target.value || null })}
                    className={inputClass}
                  />
                </label>
              </div>
            </SectionCard>

            <SectionCard icon={MonitorPlay} title="Dónde la ves">
              <FormatPicker
                value={current.format}
                onChange={(format) => save({ format: format || null })}
                options={SCREEN_PLATFORMS}
                inactiveClassName="bg-background/40 text-lavender ring-1 ring-primary-dark/40"
              />
            </SectionCard>

            <ListPicker itemId={current.id} />

            <SectionCard icon={StickyNote} title="Notas y reseña">
              <div className="flex flex-col gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-lavender">Notas</span>
                  <BlurTextarea
                    value={current.notes}
                    onSave={(notes) => save({ notes })}
                    rows={3}
                    placeholder={section.notesPlaceholder}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-lavender">Reseña</span>
                  <BlurTextarea
                    value={current.review}
                    onSave={(review) => save({ review }, 'Reseña guardada')}
                    rows={4}
                    placeholder="Tu opinión..."
                    className={inputClass}
                  />
                </label>
              </div>
            </SectionCard>
          </div>
        </div>

        <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Editar datos">
          {editOpen && (
            <MediaForm
              section={section}
              item={current}
              submitLabel="Guardar cambios"
              onSubmit={async (data) => {
                await updateItem(current.id, data)
                setEditOpen(false)
                showToast('Datos actualizados')
              }}
            />
          )}
        </BottomSheet>
        <CoverPicker
          currentUrl={current.cover_url}
          load={() => coverOptions(current)}
          open={coverOpen}
          onClose={() => setCoverOpen(false)}
          icon={TypeIcon}
          onPick={(cover_url) => {
            setCoverOpen(false)
            save({ cover_url }, 'Portada cambiada')
          }}
        />
        <ItemStatusSheet
          open={statusOpen}
          onClose={() => setStatusOpen(false)}
          value={current.status}
          onChange={handleStatus}
          labels={section.statusLabels}
          section={section}
        />
      </PageContainer>
    </>
  )
}
