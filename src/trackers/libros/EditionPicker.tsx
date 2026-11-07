import { useEffect, useRef, useState } from 'react'
import { BookOpen, Library } from 'lucide-react'
import { BottomSheet } from '../../components/BottomSheet'
import { GameThumb } from '../../components/GameThumb'
import { Skeleton } from '../../components/Skeleton'
import { bookEditions } from '../../lib/media'
import { editionFormat, editionLabel, editionLanguages, type BookEdition } from '../../lib/bookEditions'
import type { Item } from '../../types/item'

interface EditionPickerProps {
  item: Item
  open: boolean
  onClose: () => void
  /** La edición elegida y si se quiere también su portada. */
  onPick: (edition: BookEdition, withCover: boolean) => void
}

/**
 * Elegir la edición exacta de un libro: las de Open Library (primero las en
 * español) con editorial, año, idioma, páginas e ISBN. Al tocar una, sus
 * datos pasan a la ficha.
 */
export function EditionPicker({ item, open, onClose, onPick }: EditionPickerProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Elegir la edición">
      {open && <EditionPickerBody item={item} onPick={onPick} />}
    </BottomSheet>
  )
}

function EditionPickerBody({ item, onPick }: Pick<EditionPickerProps, 'item' | 'onPick'>) {
  const [editions, setEditions] = useState<BookEdition[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [withCover, setWithCover] = useState(true)

  // Una búsqueda por apertura (el cuerpo se monta al abrir la hoja).
  const initial = useRef(item)
  useEffect(() => {
    let cancelled = false
    bookEditions(initial.current)
      .then((list) => !cancelled && setEditions(list))
      .catch(() => {
        if (cancelled) return
        setFailed(true)
        setEditions([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (editions == null) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (editions.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-background/40 p-3 text-sm text-lavender">
        <Library size={16} className="shrink-0" />
        {failed ? 'No se pudieron buscar las ediciones.' : 'No encontramos ediciones de este libro.'} Puedes completar los
        datos a mano desde "Editar datos".
      </p>
    )
  }

  return (
    <div>
      <label className="mb-3 flex min-h-11 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={withCover}
          onChange={(e) => setWithCover(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        Cambiar también la portada
      </label>
      <p className="mb-3 text-xs text-lavender">
        {editions.length} {editions.length === 1 ? 'edición' : 'ediciones'} · toca la tuya para copiar sus páginas,
        ISBN y editorial
      </p>
      <ul className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pb-1">
        {editions.map((e) => {
          const isCurrent = e.isbn != null && e.isbn === item.metadata.isbn
          const details = [editionLanguages(e), editionFormat(e), e.pages ? `${e.pages} págs.` : null]
            .filter(Boolean)
            .join(' · ')
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onPick(e, withCover)}
                className="flex min-h-20 w-full items-center gap-3 rounded-xl bg-background p-2 text-left ring-1 ring-primary-dark/25 active:bg-primary-dark/10"
              >
                <div className="aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-[3px] bg-primary-dark/20">
                  <GameThumb size="thumb" src={e.cover_url} alt="" className="h-full w-full object-cover" icon={BookOpen} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{editionLabel(e) || e.title}</p>
                  {details && <p className="truncate text-xs text-lavender">{details}</p>}
                  {e.isbn && <p className="text-[11px] tabular-nums text-lavender/80">ISBN {e.isbn}</p>}
                </div>
                {isCurrent && (
                  <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                    La tuya
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
