import { useState } from 'react'
import { FormatPicker } from './FormatPicker'
import { BOOK_FORMATS, readLastBookFormat, saveLastBookFormat } from '../lib/formats'
import { GameThumb } from './GameThumb'
import { Chip } from './Chip'
import { parseTags } from '../lib/tags'
import {
  itemStatuses,
  mediaTypeIcons,
  mediaTypeLabels,
  progressKind,
  type MediaSection,
} from '../lib/media'
import type { Item, ItemStatus, ItemWrite, NonGameType } from '../types/item'

const inputClass =
  'w-full rounded-xl bg-background/40 px-3 py-2.5 text-sm text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-primary'

interface MediaFormProps {
  section: MediaSection
  /** Ítem a editar; sin él, el formulario es de alta manual. */
  item?: Item
  /** Valores iniciales del alta (ej. el título que se estaba buscando). */
  initialTitle?: string
  initialType?: NonGameType
  submitLabel: string
  onSubmit: (data: ItemWrite & Pick<Item, 'media_type' | 'title'>) => Promise<void>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-lavender">{label}</span>
      {children}
    </label>
  )
}

const positiveInt = (text: string) => {
  const n = Number(text)
  return text.trim() !== '' && Number.isInteger(n) && n > 0 ? n : null
}

const optionalText = (text: string) => text.trim() || null

/**
 * Alta manual y edición de datos de una película, serie, anime o libro.
 * Sirve tanto para lo que no está en ninguna API como para corregir lo que
 * vino de una.
 */
export function MediaForm({
  section,
  item,
  initialTitle = '',
  initialType,
  submitLabel,
  onSubmit,
}: MediaFormProps) {
  const m = item?.metadata ?? {}
  const [type, setType] = useState<NonGameType>(
    (item?.media_type as NonGameType | undefined) ?? initialType ?? section.types[0]
  )
  const [status, setStatus] = useState<ItemStatus>('planned')
  const [title, setTitle] = useState(item?.title ?? initialTitle)
  const [cover, setCover] = useState(item?.cover_url ?? '')
  const [year, setYear] = useState(item?.release_date?.slice(0, 4) ?? '')
  const [genres, setGenres] = useState(item?.genres.join(', ') ?? '')
  const [summary, setSummary] = useState(item?.summary ?? '')
  const [total, setTotal] = useState(item?.progress_total ? String(item.progress_total) : '')
  const [runtime, setRuntime] = useState(m.runtime_minutes ? String(m.runtime_minutes) : '')
  const [originalTitle, setOriginalTitle] = useState(m.original_title ?? '')
  const [authors, setAuthors] = useState(m.authors?.join(', ') ?? '')
  const [publisher, setPublisher] = useState(m.publisher ?? '')
  const [isbn, setIsbn] = useState(m.isbn ?? '')
  const [format, setFormat] = useState(item?.format ?? (item ? '' : readLastBookFormat()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kind = progressKind(type)
  const yearValid = year.trim() === '' || /^\d{4}$/.test(year.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !yearValid) return

    // Si el año no cambió se conserva la fecha completa que vino de la API.
    const y = year.trim()
    const releaseDate = !y
      ? null
      : item?.release_date?.startsWith(y)
        ? item.release_date
        : `${y}-01-01`

    const metadata = { ...m }
    const setMeta = <K extends keyof typeof metadata>(key: K, value: (typeof metadata)[K] | null) => {
      if (value == null || (Array.isArray(value) && value.length === 0)) delete metadata[key]
      else metadata[key] = value
    }
    setMeta('runtime_minutes', kind === 'pages' ? null : positiveInt(runtime))
    if (kind === 'pages') {
      setMeta('authors', parseTags(authors))
      setMeta('publisher', optionalText(publisher))
      setMeta('isbn', optionalText(isbn)?.replace(/[\s-]/g, '') ?? null)
    } else {
      setMeta('original_title', optionalText(originalTitle))
    }

    const data: ItemWrite & Pick<Item, 'media_type' | 'title'> = {
      media_type: type,
      title: title.trim(),
      cover_url: optionalText(cover),
      release_date: releaseDate,
      genres: parseTags(genres),
      summary: optionalText(summary),
      progress_total: kind === 'none' ? null : positiveInt(total),
      metadata,
    }
    if (kind === 'pages') {
      data.format = format || null
      if (!item) saveLastBookFormat(format)
    }
    if (!item) data.status = status

    setSaving(true)
    setError(null)
    try {
      await onSubmit(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {section.types.length > 1 && (
        <div
          role="group"
          aria-label="Tipo"
          className="flex rounded-full bg-background/40 p-1 ring-1 ring-primary-dark/30"
        >
          {section.types.map((t) => {
            const Icon = mediaTypeIcons[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={t === type}
                className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-medium ${
                  t === type ? 'bg-accent text-primary-darker' : 'text-lavender'
                }`}
              >
                <Icon size={16} />
                {mediaTypeLabels[t]}
              </button>
            )
          })}
        </div>
      )}

      <Field label="Título *">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </Field>

      {kind === 'pages' ? (
        <Field label="Autor(es)">
          <input
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="Separa varios con coma"
            className={inputClass}
          />
        </Field>
      ) : (
        <Field label="Título original">
          <input
            value={originalTitle}
            onChange={(e) => setOriginalTitle(e.target.value)}
            className={inputClass}
          />
        </Field>
      )}

      <div className="flex gap-3">
        <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-md bg-primary-dark/20">
          <GameThumb
            key={cover}
            src={cover.trim() || null}
            alt=""
            className="h-full w-full object-cover"
            placeholderClassName="text-2xl"
            icon={mediaTypeIcons[type]}
          />
        </div>
        <div className="flex-1">
          <Field label="Portada (URL de imagen)">
            <input
              type="url"
              inputMode="url"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Año">
          <input
            inputMode="numeric"
            maxLength={4}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2024"
            className={`${inputClass} ${yearValid ? '' : 'ring-error'}`}
          />
        </Field>
        {kind !== 'none' && (
          <Field label={kind === 'pages' ? 'Páginas' : 'Episodios'}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className={inputClass}
            />
          </Field>
        )}
        {kind !== 'pages' && (
          <Field label={kind === 'episodes' ? 'Minutos por episodio' : 'Duración (min)'}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={runtime}
              onChange={(e) => setRuntime(e.target.value)}
              className={inputClass}
            />
          </Field>
        )}
      </div>

      {kind === 'pages' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Editorial">
            <input
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="ISBN">
            <input
              inputMode="numeric"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      )}

      {kind === 'pages' && (
        <div>
          <span className="mb-1.5 block text-xs text-lavender">Formato</span>
          <FormatPicker value={format} onChange={setFormat} options={BOOK_FORMATS} />
        </div>
      )}

      <Field label="Géneros">
        <input
          value={genres}
          onChange={(e) => setGenres(e.target.value)}
          placeholder="Separa varios con coma"
          className={inputClass}
        />
      </Field>

      <Field label="Sinopsis">
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className={inputClass}
        />
      </Field>

      {!item && (
        <div>
          <span className="mb-1.5 block text-xs text-lavender">Estado</span>
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            {itemStatuses.map((s) => (
              <Chip key={s} active={s === status} onClick={() => setStatus(s)}>
                {section.statusLabels[s]}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={saving || !title.trim() || !yearValid}
        className="min-h-12 rounded-xl bg-primary font-semibold text-white disabled:opacity-40"
      >
        {saving ? 'Guardando...' : submitLabel}
      </button>
    </form>
  )
}
