import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Calendar,
  ChevronDown,
  Clock,
  Eye,
  Heart,
  Info,
  ListChecks,
  Minus,
  MoreVertical,
  Plus,
  Repeat,
  StickyNote,
  X,
} from 'lucide-react'
import { useMedia } from '../contexts/MediaContext'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { PageContainer } from '../components/PageContainer'
import { GameThumb } from '../components/GameThumb'
import { SectionCard } from '../components/SectionCard'
import { StarRating } from '../components/StarRating'
import { TagList } from '../components/TagList'
import { ItemStatusSheet } from '../components/ItemStatusSheet'
import { haptic } from '../lib/haptics'
import { todayISO } from '../lib/dates'
import {
  formatMinutes,
  hasEpisodes,
  isScreenType,
  itemStatusColor,
  screenStatusLabels,
  screenTypeIcons,
  screenTypeLabels,
  statusChanges,
} from '../lib/media'
import type { Item, ItemStatus, ItemWrite } from '../types/item'

const inputClass =
  'w-full rounded-xl bg-background/40 px-3 py-2.5 text-sm text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-primary'

/** Campo de texto que guarda al salir del campo (no en cada tecla). */
function BlurTextarea({
  value,
  onSave,
  rows,
  placeholder,
}: {
  value: string | null
  onSave: (value: string | null) => void
  rows: number
  placeholder: string
}) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => setText(value ?? ''), [value])
  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const next = text.trim() || null
        if (next !== (value ?? null)) onSave(next)
      }}
      rows={rows}
      placeholder={placeholder}
      className={inputClass}
    />
  )
}

export function MediaDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { items, loading, updateItem, deleteItem, logActivity } = useMedia()
  const { showToast, showError } = useToast()
  const confirm = useConfirm()

  const item = items.find((i) => i.id === id)
  const [statusOpen, setStatusOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  function goBack() {
    if (location.key !== 'default') navigate(-1)
    else navigate('/pantalla')
  }

  if (!item || !isScreenType(item.media_type)) {
    return (
      <PageContainer>
        <p className="text-sm text-lavender">{loading ? 'Cargando...' : 'No se encontró.'}</p>
        {!loading && (
          <button onClick={() => navigate('/pantalla')} className="mt-4 text-accent">
            Volver a Pantalla
          </button>
        )}
      </PageContainer>
    )
  }

  const current: Item = item
  const type = item.media_type
  const TypeIcon = screenTypeIcons[type]
  const episodes = hasEpisodes(type)
  const runtime = current.metadata.runtime_minutes ?? null

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

  /** +1 episodio: registra la actividad (suma el tiempo) y avanza el estado. */
  async function addEpisode() {
    if (busy) return
    setBusy(true)
    haptic()
    const today = todayISO()
    const progress = current.progress + 1
    let changes: ItemWrite = { progress }
    if (current.progress_total && progress >= current.progress_total) {
      changes = { ...statusChanges(current, 'completed', today), progress }
    } else if (current.status !== 'in_progress') {
      changes = { ...statusChanges(current, 'in_progress', today), progress }
    }
    try {
      const updated = await logActivity(
        current.id,
        { duration_minutes: runtime, progress_delta: 1 },
        changes
      )
      if (updated.status === 'completed' && current.status !== 'completed') {
        showToast(`¡Terminaste ${current.title}!`)
      }
    } catch (err) {
      showError(err, 'No se pudo registrar el episodio')
    } finally {
      setBusy(false)
    }
  }

  /** Corrección manual: no descuenta tiempo. */
  async function removeEpisode() {
    if (busy || current.progress === 0) return
    setBusy(true)
    await save({ progress: current.progress - 1 })
    setBusy(false)
  }

  /** Película vista (o vuelta a ver). */
  async function markWatched() {
    if (busy) return
    setBusy(true)
    haptic()
    const rewatch = current.status === 'completed'
    const changes: ItemWrite = rewatch
      ? { replays: current.replays + 1 }
      : statusChanges(current, 'completed', todayISO())
    try {
      await logActivity(current.id, { duration_minutes: runtime }, changes)
      showToast(rewatch ? `Volviste a ver ${current.title}` : `${current.title}: vista`)
    } catch (err) {
      showError(err, 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
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
      navigate('/pantalla', { replace: true })
    } catch (err) {
      showError(err, 'No se pudo eliminar')
    }
  }

  const year = current.release_date?.slice(0, 4)
  const percent =
    current.progress_total != null
      ? Math.min(100, Math.round((current.progress / current.progress_total) * 100))
      : null

  return (
    <>
      <div className="relative h-72 w-full overflow-hidden bg-primary-dark/20 md:h-96">
        <GameThumb
          src={current.cover_url}
          alt={current.title}
          eager
          className="h-full w-full object-cover"
          placeholderClassName="text-5xl"
          icon={TypeIcon}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, var(--color-background) 0%, transparent 55%)',
          }}
        />
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
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl bg-background-surface p-1 shadow-lg ring-1 ring-primary-dark/30">
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
          <h1 className="text-2xl font-bold">{current.title}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-lavender">
            <TypeIcon size={14} />
            {[screenTypeLabels[type], year, runtime && (episodes ? `${runtime} min/ep.` : formatMinutes(runtime))]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {current.metadata.original_title && (
            <p className="text-xs italic text-lavender/70">{current.metadata.original_title}</p>
          )}

          <div className="mb-4 mt-4 flex items-center gap-2">
            <button
              onClick={() => setStatusOpen(true)}
              className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium ${itemStatusColor(current.status)}`}
            >
              {screenStatusLabels[current.status]}
              <ChevronDown size={14} />
            </button>
            <button
              onClick={() => save({ is_favorite: !current.is_favorite })}
              aria-label={current.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
              aria-pressed={current.is_favorite}
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ring-1 ring-primary-dark/30 ${
                current.is_favorite ? 'bg-accent text-primary-darker' : 'bg-background-surface text-lavender'
              }`}
            >
              <Heart size={18} fill={current.is_favorite ? 'currentColor' : 'none'} />
            </button>
          </div>
          <ItemStatusSheet
            open={statusOpen}
            onClose={() => setStatusOpen(false)}
            value={current.status}
            onChange={handleStatus}
            labels={screenStatusLabels}
          />

          <div className="flex flex-col gap-4">
            {episodes ? (
              <SectionCard icon={ListChecks} title="Episodios">
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={removeEpisode}
                    disabled={busy || current.progress === 0}
                    aria-label="Quitar un episodio"
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-background/40 text-lavender ring-1 ring-primary-dark/30 disabled:opacity-40"
                  >
                    <Minus size={20} />
                  </button>
                  <div className="text-center">
                    <p className="text-3xl font-bold tabular-nums text-ink">
                      {current.progress}
                      <span className="text-lg font-normal text-lavender">
                        {' '}
                        / {current.progress_total ?? '?'}
                      </span>
                    </p>
                    {percent != null && <p className="text-xs text-lavender">{percent}%</p>}
                  </div>
                  <button
                    onClick={addEpisode}
                    disabled={busy}
                    aria-label="Sumar un episodio"
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white disabled:opacity-60"
                  >
                    <Plus size={22} />
                  </button>
                </div>
                {percent != null && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary-dark/30">
                    <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
                  </div>
                )}
                <label className="mt-3 flex items-center justify-between gap-3 text-sm text-lavender">
                  Total de episodios
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    defaultValue={current.progress_total ?? ''}
                    key={current.progress_total ?? 'none'}
                    onBlur={(e) => {
                      const n = Number(e.target.value)
                      const next = Number.isInteger(n) && n > 0 ? n : null
                      if (next !== current.progress_total) save({ progress_total: next })
                    }}
                    className="w-20 rounded-lg bg-background/40 px-2 py-1.5 text-right text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
              </SectionCard>
            ) : (
              <button
                onClick={markWatched}
                disabled={busy}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white disabled:opacity-60"
              >
                {current.status === 'completed' ? <Repeat size={18} /> : <Eye size={18} />}
                {current.status === 'completed' ? 'La volví a ver' : 'Marcar como vista'}
              </button>
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

            <SectionCard icon={StickyNote} title="Notas y reseña">
              <div className="flex flex-col gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-lavender">Notas</span>
                  <BlurTextarea
                    value={current.notes}
                    onSave={(notes) => save({ notes })}
                    rows={3}
                    placeholder="Dónde quedaste, con quién la ves..."
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-lavender">Reseña</span>
                  <BlurTextarea
                    value={current.review}
                    onSave={(review) => save({ review }, 'Reseña guardada')}
                    rows={4}
                    placeholder="Tu opinión..."
                  />
                </label>
              </div>
            </SectionCard>

            {(current.summary || current.genres.length > 0) && (
              <SectionCard icon={Info} title="Sinopsis">
                {current.genres.length > 0 && (
                  <div className="mb-2">
                    <TagList value={current.genres.join(", ")} />
                  </div>
                )}
                {current.summary && (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-lavender">
                    {current.summary}
                  </p>
                )}
              </SectionCard>
            )}
          </div>
        </div>
      </PageContainer>
    </>
  )
}
