import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Feather, Loader2, Plus } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { useToast } from '../../contexts/ToastContext'
import { GameThumb } from '../../components/GameThumb'
import { SectionCard } from '../../components/SectionCard'
import { authorSuggestions, mainAuthor, ownBooksByAuthor } from '../../lib/authorBooks'
import { todayISO } from '../../lib/dates'
import { readLastBookFormat } from '../../lib/formats'
import { haptic } from '../../lib/haptics'
import { booksByAuthor, mediaSections, resultToItemWithStatus, withDetails } from '../../lib/media'
import type { Item, ItemStatus, MediaSearchResult } from '../../types/item'

const section = mediaSections.libros
/** Sugerencias que se ven antes de "Ver más". */
const FIRST_SUGGESTIONS = 3

// Por sesión de la app: la obra de un autor cambia muy poco.
const cache = new Map<string, MediaSearchResult[]>()

const keyOf = (r: MediaSearchResult) => `${r.source}:${r.external_id}`

/**
 * "Más de este autor": los otros libros del mismo autor que ya tienes (con
 * un toque van a su ficha) y sugerencias de Open Library para sumar al
 * librero. Sin autor, o sin sugerencias y sin libros propios, no se muestra.
 */
export function MoreByAuthor({ item }: { item: Item }) {
  const author = mainAuthor(item)
  const { items, addItem } = useMedia()
  const { showToast, showError } = useToast()
  const navigate = useNavigate()
  const [found, setFound] = useState<MediaSearchResult[] | null>(() => (author ? (cache.get(author) ?? null) : null))
  const [adding, setAdding] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!author || cache.has(author)) return
    let cancelled = false
    booksByAuthor(author)
      .catch(() => [] as MediaSearchResult[])
      .then((list) => {
        cache.set(author, list)
        if (!cancelled) setFound(list)
      })
    return () => {
      cancelled = true
    }
  }, [author])

  const books = useMemo(() => items.filter((i) => i.media_type === 'book'), [items])
  const own = useMemo(() => (author ? ownBooksByAuthor(books, item, author) : []), [books, item, author])
  const suggestions = useMemo(() => authorSuggestions(books, item, found ?? []), [books, item, found])

  if (!author || (own.length === 0 && suggestions.length === 0)) return null

  async function add(result: MediaSearchResult, status: ItemStatus) {
    haptic()
    setAdding(keyOf(result))
    try {
      const full = await withDetails(result)
      const created = await addItem({
        ...resultToItemWithStatus(full, status, todayISO()),
        format: readLastBookFormat() || null,
      })
      showToast(`${created.title}: ${section.statusLabels[status]}`)
      if (status === 'in_progress') navigate(section.detailPath(created.id))
    } catch (err) {
      showError(err, 'No se pudo agregar')
    } finally {
      setAdding(null)
    }
  }

  const shown = showAll ? suggestions : suggestions.slice(0, FIRST_SUGGESTIONS)

  return (
    <SectionCard icon={Feather} title={`Más de ${author}`}>
      {own.length > 0 && (
        <div className={suggestions.length > 0 ? 'mb-4' : undefined}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-lavender">
            En tu librero · {own.length}
          </p>
          <div className="scrollbar-hide -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
            {own.map((b) => (
              <Link
                key={b.id}
                to={section.detailPath(b.id)}
                aria-label={`${b.title} (${section.statusLabels[b.status]})`}
                className="relative h-28 w-[4.6rem] shrink-0 overflow-hidden rounded-[3px] bg-primary-dark/20 shadow-[0_3px_6px_rgba(0,0,0,0.25)] transition-transform active:-translate-y-1"
              >
                <GameThumb size="poster" src={b.cover_url} alt="" className="h-full w-full object-cover" icon={BookOpen} />
                {!b.cover_url && (
                  <span className="font-book absolute inset-x-1 bottom-1 line-clamp-3 text-center text-[9px] font-semibold leading-tight text-ink">
                    {b.title}
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-center text-[9px] font-semibold text-white">
                  {section.statusLabels[b.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-lavender">Para descubrir</p>
          <ul className="flex flex-col gap-3">
            {shown.map((s) => (
              <li key={keyOf(s)} className="flex gap-3">
                <div className="aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-[3px] bg-primary-dark/20 shadow-sm">
                  <GameThumb size="thumb" src={s.cover_url} alt="" className="h-full w-full object-cover" icon={BookOpen} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-book font-semibold text-ink">{s.title}</p>
                  <p className="text-xs text-lavender">
                    {[s.release_date?.slice(0, 4), s.pages ? `${s.pages} págs.` : null].filter(Boolean).join(' · ')}
                  </p>
                  {adding === keyOf(s) ? (
                    <p className="mt-1 flex min-h-11 items-center gap-1.5 text-sm text-lavender">
                      <Loader2 size={15} className="animate-spin" /> Agregando...
                    </p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => add(s, 'wishlist')}
                        className="flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-semibold text-white active:scale-95"
                      >
                        <Plus size={14} /> {section.statusLabels.wishlist}
                      </button>
                      <button
                        type="button"
                        onClick={() => add(s, 'in_progress')}
                        className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-accent ring-1 ring-primary-dark/30 active:bg-primary-dark/10"
                      >
                        <BookOpen size={14} /> Empezar a leer
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {suggestions.length > FIRST_SUGGESTIONS && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-accent active:bg-primary-dark/10"
            >
              Ver más ({suggestions.length - FIRST_SUGGESTIONS})
            </button>
          )}
        </div>
      )}
    </SectionCard>
  )
}
