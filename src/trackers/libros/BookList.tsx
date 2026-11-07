// Vista de lista compacta del librero: una fila por libro, con el dato por el
// que se está ordenando a la derecha.

import { useState } from 'react'
import { BookOpen, Check, Heart } from 'lucide-react'
import { GameThumb } from '../../components/GameThumb'
import { formatDate } from '../../lib/dates'
import { finishedDates } from '../../lib/readings'
import { mediaSections } from '../../lib/media'
import type { BookSort } from '../../lib/bookView'
import type { Item } from '../../types/item'

const section = mediaSections.libros
/** Filas por tanda: cientos a la vez traban el teléfono. */
const PAGE = 80

/** El dato destacado de la fila, según el orden elegido. */
function detail(item: Item, sort: BookSort | null): string | null {
  switch (sort) {
    case 'puntaje':
      return item.rating != null ? `★ ${(item.rating / 2).toFixed(1)}` : null
    case 'paginas':
      return item.progress_total ? `${item.progress_total.toLocaleString()} págs.` : null
    case 'terminado': {
      const last = finishedDates(item).sort().pop()
      return last ? formatDate(last) : null
    }
    case 'publicado':
      return item.release_date ? item.release_date.slice(0, 4) : null
    case 'agregado':
      return formatDate(item.created_at)
    default:
      return item.rating != null ? `★ ${(item.rating / 2).toFixed(1)}` : null
  }
}

export function BookList({
  items,
  sort,
  onOpenBook,
  selected,
}: {
  items: Item[]
  sort: BookSort | null
  onOpenBook: (item: Item) => void
  /** Ids marcados en modo selección (undefined fuera del modo). */
  selected?: ReadonlySet<string>
}) {
  const [limit, setLimit] = useState(PAGE)
  return (
    <div className="rounded-2xl bg-background-surface ring-1 ring-primary-dark/15">
      <ul className="divide-y divide-primary-dark/10">
        {items.slice(0, limit).map((item) => {
          const authors = item.metadata.authors?.join(', ')
          const extra = detail(item, sort)
          const isSelected = selected?.has(item.id)
          return (
            <li key={item.id} className="cv-row">
              <button
                type="button"
                onClick={() => onOpenBook(item)}
                aria-pressed={isSelected}
                className={`flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left active:bg-primary-dark/10 ${
                  isSelected ? 'bg-accent/10' : ''
                }`}
              >
                {selected && (
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ring-2 ${
                      isSelected ? 'bg-accent text-white ring-accent' : 'ring-lavender/50'
                    }`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </span>
                )}
                <GameThumb
                  size="thumb"
                  src={item.cover_url}
                  alt=""
                  className="h-14 w-10 flex-shrink-0 rounded-[3px] object-cover shadow-sm"
                  placeholderClassName="text-lg"
                  icon={BookOpen}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-book flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <span className="truncate">{item.title}</span>
                    {item.is_favorite && <Heart size={12} className="flex-shrink-0 fill-accent text-accent" />}
                  </span>
                  <span className="block truncate text-xs text-lavender">{authors || 'Sin autor'}</span>
                  <span className="mt-0.5 inline-block text-[11px] text-lavender/80">
                    {section.statusLabels[item.status]}
                    {item.status === 'in_progress' && item.progress_total
                      ? ` · ${Math.min(100, Math.round((item.progress / item.progress_total) * 100))}%`
                      : ''}
                  </span>
                </span>
                {extra && (
                  <span className="flex-shrink-0 text-xs font-semibold tabular-nums text-accent">{extra}</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {items.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE)}
          className="mx-auto my-3 flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-accent active:bg-primary-dark/10"
        >
          Mostrar más ({items.length - limit})
        </button>
      )}
    </div>
  )
}
