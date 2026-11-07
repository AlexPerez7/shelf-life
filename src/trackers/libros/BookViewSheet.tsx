// Hoja de "Ordenar y filtrar" del librero.

import { Heart } from 'lucide-react'
import { BottomSheet } from '../../components/BottomSheet'
import { Chip } from '../../components/Chip'
import { bookSorts, defaultDir, dirLabels, type BookSort, type BookView, type SortDir } from '../../lib/bookView'

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-lavender">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  )
}

export function BookViewSheet({
  open,
  onClose,
  view,
  years,
  genres,
  onSort,
  onDir,
  onYear,
  onGenre,
  onFavorites,
  onClear,
}: {
  open: boolean
  onClose: () => void
  view: BookView
  years: number[]
  genres: string[]
  onSort: (sort: BookSort | null) => void
  onDir: (dir: SortDir) => void
  onYear: (year: number | null) => void
  onGenre: (genre: string | null) => void
  onFavorites: (on: boolean) => void
  onClear: () => void
}) {
  const dir = view.sort ? (view.dir ?? defaultDir(view.sort)) : null
  const labels = view.sort ? dirLabels(view.sort) : null

  return (
    <BottomSheet open={open} onClose={onClose} title="Ordenar y filtrar">
      <Group title="Ordenar por">
        {bookSorts.map((s) => (
          <Chip key={s.id} active={view.sort === s.id} onClick={() => onSort(view.sort === s.id ? null : s.id)}>
            {s.label}
          </Chip>
        ))}
      </Group>

      {labels && (
        <Group title="Dirección">
          {(['asc', 'desc'] as const).map((d, i) => (
            <Chip key={d} active={dir === d} onClick={() => onDir(d)}>
              {labels[i]}
            </Chip>
          ))}
        </Group>
      )}

      <Group title="Filtrar">
        <Chip active={view.favorites} onClick={() => onFavorites(!view.favorites)}>
          <Heart size={13} className="mr-1.5" /> Favoritos
        </Chip>
      </Group>

      {years.length > 0 && (
        <Group title="Año en que lo terminaste">
          {years.map((y) => (
            <Chip key={y} active={view.year === y} onClick={() => onYear(view.year === y ? null : y)}>
              {y}
            </Chip>
          ))}
        </Group>
      )}

      {genres.length > 0 && (
        <Group title="Género">
          {genres.map((g) => (
            <Chip key={g} active={view.genre === g} onClick={() => onGenre(view.genre === g ? null : g)}>
              {g}
            </Chip>
          ))}
        </Group>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClear}
          className="min-h-12 flex-1 rounded-xl text-sm font-medium text-accent ring-1 ring-primary-dark/25 active:bg-primary-dark/10"
        >
          Limpiar todo
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 flex-1 rounded-xl bg-primary font-semibold text-white"
        >
          Listo
        </button>
      </div>
    </BottomSheet>
  )
}
