import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  Calendar,
  ChevronDown,
  Clock,
  Disc3,
  Heart,
  Library,
  MoreVertical,
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
import { FormatPicker } from '../../components/FormatPicker'
import { BOOK_FORMATS } from '../../lib/formats'
import { haptic } from '../../lib/haptics'
import { sizedCover } from '../../lib/images'
import { parseDate, todayISO } from '../../lib/dates'
import {
  formatMinutes,
  itemStatusColor,
  mediaSections,
  progressChanges,
  statusChanges,
} from '../../lib/media'
import type { Item, ItemStatus, ItemWrite } from '../../types/item'

const section = mediaSections.libros

const inputClass =
  'w-full rounded-xl bg-background px-3 py-2.5 text-sm text-ink ring-1 ring-primary-dark/25 focus:outline-none focus:ring-2 focus:ring-primary'

/** Atajos para sumar páginas a la que se está escribiendo. */
const PAGE_STEPS = [10, 25, 50]

/** Minutos por página, si hay suficiente lectura registrada para estimarlo. */
function minutesPerPage(item: Item) {
  return item.time_spent_minutes > 0 && item.progress >= 10 ? item.time_spent_minutes / item.progress : null
}

interface ReadingProps {
  item: Item
  busy: boolean
  onSetPage: (page: number, minutes: number | null) => void
  onSaveTotal: (total: number | null) => void
}

/**
 * Lectura en curso: dónde vas, cuánto falta (y cuánto tiempo, a tu ritmo) y
 * el registro de la página actual, con minutos opcionales. Se monta con
 * `key` = página actual, así el campo vuelve a ella después de guardar.
 */
function Reading({ item, busy, onSetPage, onSaveTotal }: ReadingProps) {
  const [page, setPage] = useState(String(item.progress || ''))
  const [minutes, setMinutes] = useState('')

  const total = item.progress_total
  const percent = total ? Math.min(100, Math.round((item.progress / total) * 100)) : null
  const left = total != null ? Math.max(0, total - item.progress) : null
  const pace = minutesPerPage(item)

  const pageNumber = Number(page)
  const valid =
    page !== '' &&
    Number.isInteger(pageNumber) &&
    pageNumber >= 0 &&
    (total == null || pageNumber <= total) &&
    pageNumber !== item.progress

  function step(n: number) {
    const base = Number.isInteger(pageNumber) && page !== '' ? pageNumber : item.progress
    setPage(String(total != null ? Math.min(total, base + n) : base + n))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const m = Number(minutes)
    onSetPage(pageNumber, Number.isInteger(m) && m > 0 ? m : null)
    setMinutes('')
  }

  return (
    <SectionCard icon={BookOpen} title="Lectura">
      <div className="flex items-end justify-between gap-3">
        <p className="font-book text-4xl font-bold tabular-nums text-ink">
          {item.progress}
          <span className="font-sans text-base font-normal text-lavender"> / {total ?? '?'} págs.</span>
        </p>
        {percent != null && <p className="font-book text-2xl font-bold text-accent">{percent}%</p>}
      </div>
      {percent != null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-dark/15">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
        </div>
      )}
      {left != null && left > 0 && (
        <p className="mt-1.5 text-xs text-lavender">
          {left === 1 ? 'Te queda 1 página' : `Te quedan ${left} páginas`}
          {pace ? ` · ~${formatMinutes(left * pace)} a tu ritmo` : ''}
        </p>
      )}

      <form onSubmit={submit} className="mt-4">
        <div className="flex items-end gap-2">
          <label className="block flex-1">
            <span className="mb-1 block text-xs text-lavender">Voy en la página</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={total ?? undefined}
              value={page}
              onChange={(e) => setPage(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block w-24">
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
        <div className="mt-2 flex items-center gap-2">
          {PAGE_STEPS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => step(n)}
              className="min-h-10 rounded-full bg-background px-3 text-sm font-medium text-ink ring-1 ring-primary-dark/25 active:bg-primary-dark/10"
            >
              +{n}
            </button>
          ))}
          <button
            type="submit"
            disabled={!valid || busy}
            className="ml-auto min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </form>

      <label className="mt-4 flex items-center justify-between gap-3 text-sm text-lavender">
        Total de páginas
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
          className="w-20 rounded-lg bg-background px-2 py-1.5 text-right text-ink ring-1 ring-primary-dark/25 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
    </SectionCard>
  )
}

/**
 * Ficha de un libro, en el tema "papel" del tracker (inspirado en
 * Openreads): portada centrada sobre la misma portada difuminada, la lectura
 * en curso y una acción según el estado (empezar a leer, releer).
 */
export function BookDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { items, loading, updateItem, deleteItem, logActivity } = useMedia()
  const { showToast, showError } = useToast()
  const confirm = useConfirm()

  const item = items.find((i) => i.id === id)
  const [statusOpen, setStatusOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  function goBack() {
    if (location.key !== 'default') navigate(-1)
    else navigate(section.libraryPath)
  }

  if (!item || item.media_type !== 'book') {
    return (
      <PageContainer>
        <p className="text-sm text-lavender">{loading ? 'Cargando...' : 'No se encontró.'}</p>
        {!loading && (
          <button onClick={() => navigate(section.libraryPath)} className="mt-4 min-h-11 text-accent">
            Volver al librero
          </button>
        )}
      </PageContainer>
    )
  }

  const current: Item = item
  const authors = current.metadata.authors ?? []
  const notStarted = current.status === 'wishlist' || current.status === 'planned'
  const showReading = !notStarted && current.status !== 'completed'
  const pace = minutesPerPage(current)

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
   * Nueva página actual. Avanzar registra la lectura (páginas y minutos
   * opcionales); retroceder es una corrección y no registra nada.
   */
  async function setPage(page: number, minutes: number | null) {
    if (busy || page === current.progress) return
    setBusy(true)
    haptic()
    try {
      if (page > current.progress) {
        const updated = await logActivity(
          current.id,
          { duration_minutes: minutes, progress_delta: page - current.progress },
          progressChanges(current, page, todayISO())
        )
        if (updated.status === 'completed' && current.status !== 'completed') {
          showToast(`¡Terminaste ${current.title}!`)
        }
      } else {
        await updateItem(current.id, { progress: page })
      }
    } catch (err) {
      showError(err, 'No se pudo guardar la página')
    } finally {
      setBusy(false)
    }
  }

  async function startReading() {
    haptic()
    await save(statusChanges(current, 'in_progress', todayISO()), `Empezaste ${current.title}`)
  }

  /** Releer: vuelve a la página 0 y cuenta una relectura. */
  async function reread() {
    haptic()
    await save(
      { status: 'in_progress', progress: 0, replays: current.replays + 1, date_started: todayISO(), date_finished: null },
      `Empezaste a releer ${current.title}`
    )
  }

  async function handleDelete() {
    setMenuOpen(false)
    const ok = await confirm({
      title: `¿Eliminar ${current.title}?`,
      message: 'Se borra de tu librero junto con su historial de lectura.',
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

  const facts = [
    current.format,
    current.release_date?.slice(0, 4),
    current.progress_total ? `${current.progress_total} págs.` : null,
    current.metadata.publisher,
  ].filter(Boolean)

  return (
    <>
      {/* La portada centrada sobre sí misma difuminada: recortarla a todo el
          ancho cortaría el título y el autor impresos en la tapa. */}
      <div
        className="relative w-full overflow-hidden pb-5"
        style={{ paddingTop: 'calc(4.5rem + env(safe-area-inset-top))' }}
      >
        {current.cover_url && (
          <img
            src={sizedCover(current.cover_url, 'thumb') ?? undefined}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl"
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, var(--color-background) 5%, transparent 85%)' }}
        />
        <div className="relative mx-auto aspect-[2/3] w-40 overflow-hidden rounded-[4px] bg-primary-dark/20 shadow-[0_18px_30px_-8px_rgba(42,38,32,0.55)] md:w-48">
          <GameThumb
            src={current.cover_url}
            alt={current.title}
            eager
            className="h-full w-full object-cover"
            placeholderClassName="text-5xl"
            icon={BookOpen}
          />
          {/* Lomo: una sombra fina a la izquierda, como un libro de verdad. */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/25 to-transparent" />
          {!current.cover_url && (
            <span className="font-book absolute inset-x-2 bottom-3 line-clamp-4 text-center text-sm font-semibold leading-tight text-ink">
              {current.title}
            </span>
          )}
        </div>

        <div
          className="absolute inset-x-4 flex items-start justify-between"
          style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
        >
          <button
            onClick={goBack}
            aria-label="Volver"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-background/80 text-ink shadow-sm backdrop-blur"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Más opciones"
              aria-expanded={menuOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-background/80 text-ink shadow-sm backdrop-blur"
            >
              <MoreVertical size={20} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl bg-background-surface p-1 shadow-lg ring-1 ring-primary-dark/20">
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      setEditOpen(true)
                    }}
                    className="w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-ink active:bg-primary-dark/10"
                  >
                    Editar datos
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
          <div className="text-center">
            <h1 className="text-2xl font-bold leading-tight text-ink">{current.title}</h1>
            {authors.length > 0 && <p className="font-book mt-1 text-ink/80">{authors.join(', ')}</p>}
            {facts.length > 0 && <p className="mt-0.5 text-sm text-lavender">{facts.join(' · ')}</p>}
          </div>

          <div className="mb-4 mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => setStatusOpen(true)}
              className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${itemStatusColor(current.status, section)}`}
            >
              {section.statusLabels[current.status]}
              <ChevronDown size={14} />
            </button>
            <button
              onClick={() => save({ is_favorite: !current.is_favorite })}
              aria-label={current.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
              aria-pressed={current.is_favorite}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-primary-dark/20 ${
                current.is_favorite ? 'bg-accent text-white' : 'bg-background-surface text-lavender'
              }`}
            >
              <Heart size={18} fill={current.is_favorite ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {notStarted && (
              <button
                type="button"
                onClick={startReading}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
              >
                <BookMarked size={18} /> Empezar a leer
              </button>
            )}

            {showReading && (
              <Reading
                key={current.progress}
                item={current}
                busy={busy}
                onSetPage={setPage}
                onSaveTotal={(progress_total) => save({ progress_total })}
              />
            )}

            {current.status === 'completed' && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-accent/10 p-4 ring-1 ring-accent/25">
                <div>
                  <p className="font-book font-semibold text-ink">Leído</p>
                  {current.date_finished && (
                    <p className="text-xs text-lavender">
                      {parseDate(current.date_finished).toLocaleDateString('es', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={reread}
                  className="flex min-h-11 items-center gap-1.5 rounded-full bg-background-surface px-4 text-sm font-semibold text-accent shadow-sm ring-1 ring-accent/25 active:bg-accent/10"
                >
                  <RotateCcw size={15} /> Releer
                </button>
              </div>
            )}

            {(current.summary || current.genres.length > 0) && (
              <div>
                {current.genres.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {current.genres.map((g) => (
                      <span
                        key={g}
                        className="rounded-full bg-background-surface px-3 py-1 text-xs text-lavender ring-1 ring-primary-dark/20"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
                {current.summary && <Synopsis text={current.summary} className="font-book" />}
              </div>
            )}

            <SectionCard icon={Clock} title="Mi registro">
              <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-lavender">Lectura</p>
                  <p className="font-semibold text-ink">
                    {current.time_spent_minutes > 0 ? formatMinutes(current.time_spent_minutes) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-lavender">Ritmo</p>
                  <p className="font-semibold text-ink">{pace ? `${Math.round(60 / pace)} págs/h` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-lavender">Relecturas</p>
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
                    placeholder="Qué te pareció..."
                    className={`font-book ${inputClass}`}
                  />
                </label>
              </div>
            </SectionCard>

            <SectionCard icon={Disc3} title="Formato">
              <FormatPicker
                value={current.format}
                onChange={(format) => save({ format: format || null })}
                options={BOOK_FORMATS}
                inactiveClassName="bg-background text-lavender ring-1 ring-primary-dark/25"
              />
            </SectionCard>

            <ListPicker itemId={current.id} inactiveClassName="bg-background text-lavender ring-1 ring-primary-dark/25" />

            {(current.metadata.publisher || current.metadata.isbn || current.metadata.original_title) && (
              <SectionCard icon={Library} title="Edición">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {current.metadata.publisher && (
                    <>
                      <dt className="text-lavender">Editorial</dt>
                      <dd className="text-ink">{current.metadata.publisher}</dd>
                    </>
                  )}
                  {current.metadata.isbn && (
                    <>
                      <dt className="text-lavender">ISBN</dt>
                      <dd className="tabular-nums text-ink">{current.metadata.isbn}</dd>
                    </>
                  )}
                  {current.metadata.original_title && (
                    <>
                      <dt className="text-lavender">Título original</dt>
                      <dd className="italic text-ink">{current.metadata.original_title}</dd>
                    </>
                  )}
                </dl>
              </SectionCard>
            )}
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
