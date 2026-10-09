// Piezas del librero: repisas, muebles y libros (portada o lomo). Todo el
// tracker de libros se ve como un librero; acá vive ese diseño.

import type { ReactNode } from 'react'
import { ChevronRight, BookOpen } from 'lucide-react'
import { GameThumb } from '../../components/GameThumb'
import type { Item } from '../../types/item'

export type ShelfMode = 'portadas' | 'lomos'

/** Hash estable de un texto (para colores, alturas y adornos). */
function hash(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Colores de lomo: tonos apagados de encuadernación. */
const SPINE_COLORS = [
  ['#1f6f66', '#f6f2e9'], // verde azulado
  ['#7a2e3a', '#f6e9df'], // borgoña
  ['#27406b', '#e9eef7'], // azul marino
  ['#b7832f', '#2a2620'], // mostaza
  ['#5d6b3a', '#f1f0e2'], // oliva
  ['#5b3a63', '#f3e9f4'], // ciruela
  ['#a4553a', '#fbeee6'], // terracota
  ['#d9cbb2', '#2a2620'], // lino
  ['#2f3b3a', '#e7efe9'], // pizarra
]

/** Adornos para los huecos de las repisas. */
const DECOR = ['🪴', '🕯️', '☕', '🌷', '🦉', '🌵', '🍂', '🧸']

export function decorFor(seed: string) {
  return DECOR[hash(seed) % DECOR.length]
}

function percentOf(item: Item) {
  return item.progress_total
    ? Math.min(100, Math.round((item.progress / item.progress_total) * 100))
    : null
}

/** Cinta de marcador con el % leído (libros que se están leyendo). */
function Ribbon({ item }: { item: Item }) {
  const percent = percentOf(item)
  if (item.status !== 'in_progress' || percent == null) return null
  return (
    <span className="absolute -top-1 right-1.5 rounded-b-sm bg-amber-500 px-1 pb-1 pt-1.5 text-[9px] font-bold leading-none text-white shadow">
      {percent}%
    </span>
  )
}

/** Un libro parado en la repisa: su portada o su lomo. */
export function ShelfBook({
  item,
  mode,
  onOpen,
}: {
  item: Item
  mode: ShelfMode
  onOpen: () => void
}) {
  const label = `${item.title}${item.metadata.authors?.length ? `, de ${item.metadata.authors[0]}` : ''}`

  if (mode === 'lomos') {
    const h = hash(item.id)
    const [bg, fg] = SPINE_COLORS[h % SPINE_COLORS.length]
    // Grosor según páginas (lo que da la API o el usuario), con límites.
    const width = Math.max(22, Math.min(46, Math.round((item.progress_total ?? 280) / 11)))
    const height = 96 + (h % 4) * 6
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        title={item.title}
        className="relative flex flex-shrink-0 flex-col items-center justify-between rounded-[3px] py-2 shadow-[inset_-3px_0_0_rgba(0,0,0,0.15),inset_2px_0_0_rgba(255,255,255,0.12),0_2px_4px_rgba(0,0,0,0.25)] transition-transform active:-translate-y-1"
        style={{ width, height, backgroundColor: bg, color: fg }}
      >
        <span className="h-px w-3/4 bg-current opacity-40" />
        <span
          className="font-book max-h-[78%] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-semibold leading-none"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {item.title}
        </span>
        <span className="h-px w-3/4 bg-current opacity-40" />
        <Ribbon item={item} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={item.title}
      className="relative h-[7.5rem] w-20 flex-shrink-0 overflow-hidden rounded-[3px] bg-primary-dark/20 shadow-[0_3px_6px_rgba(0,0,0,0.3)] transition-transform active:-translate-y-1"
    >
      <GameThumb
        src={item.cover_url}
        alt=""
        className="h-full w-full object-cover"
        placeholderClassName="text-2xl"
        icon={BookOpen}
      />
      {/* Sin portada: el título, para que el libro se reconozca. */}
      {!item.cover_url && (
        <span className="font-book absolute inset-x-1 bottom-1.5 line-clamp-3 text-center text-[10px] font-semibold leading-tight text-ink">
          {item.title}
        </span>
      )}
      <Ribbon item={item} />
    </button>
  )
}

/** Tabla de la repisa, con canto y sombra. */
function Plank() {
  return (
    <div
      aria-hidden="true"
      className="h-3 rounded-sm shadow-[0_6px_8px_-2px_rgba(60,40,20,0.35)]"
      style={{ background: 'linear-gradient(to bottom, #e9d8bd 0%, #d4bc98 45%, #b89a72 100%)' }}
    />
  )
}

/** Adorno parado en la repisa. */
function Decor({ seed }: { seed: string }) {
  return (
    <span aria-hidden="true" className="flex-shrink-0 select-none self-end px-1 text-4xl leading-none">
      {decorFor(seed)}
    </span>
  )
}

/**
 * Repisa: etiqueta ("ESTADO · Leyendo · 3") y una fila de libros que se
 * desliza hacia los lados. Tocar la etiqueta abre el estante completo.
 */
export function Shelf({
  id,
  category,
  name,
  items,
  mode,
  onOpenBook,
  onOpenShelf,
  emptyText = 'Todavía no hay libros acá.',
}: {
  id: string
  category: string
  name: string
  items: Item[]
  mode: ShelfMode
  onOpenBook: (item: Item) => void
  onOpenShelf?: () => void
  emptyText?: string
}) {
  // Un adorno en el medio de las repisas largas y otro al final.
  const midDecor = items.length >= 5 ? (hash(id) % (items.length - 2)) + 1 : -1

  return (
    <div>
      <button
        type="button"
        onClick={onOpenShelf}
        disabled={!onOpenShelf}
        className="mb-2 flex min-h-9 w-full items-center gap-2 rounded-full bg-background-surface/80 px-3 text-left ring-1 ring-primary-dark/15 active:bg-background-surface"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-lavender">{category}</span>
        <span className="font-book min-w-0 flex-1 truncate text-sm font-semibold text-ink">{name}</span>
        <span className="rounded-full bg-primary-dark/15 px-2 text-xs tabular-nums text-lavender">{items.length}</span>
        {onOpenShelf && <ChevronRight size={14} className="text-lavender" />}
      </button>

      <div className="scrollbar-hide -mx-1 flex min-h-[7.75rem] items-end gap-1.5 overflow-x-auto px-2 pt-1">
        {items.length === 0 && (
          <p className="self-center px-2 text-xs italic text-lavender">{emptyText}</p>
        )}
        {items.map((item, i) => (
          <div key={item.id} className="contents">
            {i === midDecor && <Decor seed={`${id}-mid`} />}
            <ShelfBook item={item} mode={mode} onOpen={() => onOpenBook(item)} />
          </div>
        ))}
        <Decor seed={id} />
        <div className="w-2 flex-shrink-0" aria-hidden="true" />
      </div>
      <Plank />
    </div>
  )
}

/** Mueble: agrupa varias repisas bajo un título. */
export function ShelfUnit({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className="rounded-3xl p-3 pb-4 shadow-[inset_0_2px_10px_rgba(60,40,20,0.12)] ring-1 ring-[#c9b28f]/50"
      style={{ background: 'linear-gradient(to bottom, #efe5d3, #e8dcc6)' }}
    >
      <h2 className="mb-3 px-1 text-lg font-bold text-ink">{title}</h2>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  )
}

/**
 * Estante completo: los libros en varias filas, cada una sobre su tabla
 * (la tabla se dibuja como fondo repetido, una por fila).
 */
export function Bookcase({
  items,
  mode,
  onOpenBook,
}: {
  items: Item[]
  mode: ShelfMode
  onOpenBook: (item: Item) => void
}) {
  const ROW = 144 // alto de cada fila, en px (libro + tabla)
  return (
    <div
      className="rounded-3xl p-3 shadow-[inset_0_2px_10px_rgba(60,40,20,0.12)] ring-1 ring-[#c9b28f]/50"
      style={{ background: 'linear-gradient(to bottom, #efe5d3, #e8dcc6)' }}
    >
      <div
        className="flex flex-wrap items-end gap-x-1.5 px-1"
        style={{
          rowGap: 0,
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW - 12}px, #d4bc98 ${ROW - 12}px, #b89a72 ${ROW}px)`,
        }}
      >
        {items.map((item) => (
          <div key={item.id} className="flex items-end pb-3" style={{ height: ROW }}>
            <ShelfBook item={item} mode={mode} onOpen={() => onOpenBook(item)} />
          </div>
        ))}
        <div className="flex items-end pb-3" style={{ height: ROW }}>
          <Decor seed={`case-${items.length}`} />
        </div>
      </div>
    </div>
  )
}
