import { useState } from 'react'
import { BottomSheet } from './BottomSheet'
import type { Item } from '../types/item'

interface PageSheetProps {
  /** Libro abierto (null = hoja cerrada). */
  book: Item | null
  /** Minutos ya medidos (al terminar el cronómetro de lectura). */
  minutes?: number | null
  onClose: () => void
  onSave: (page: number, minutes: number | null) => void
}

/**
 * Anotar en qué página vas sin entrar a la ficha (inicio) o al terminar el
 * cronómetro de lectura: con los minutos ya puestos y la opción de guardar
 * solo el tiempo si no se avanzó de página.
 */
export function PageSheet({ book, minutes, onClose, onSave }: PageSheetProps) {
  return (
    <BottomSheet open={book != null} onClose={onClose} title={book?.title ?? 'Página'}>
      {book && <PageForm key={`${book.id}-${minutes ?? ''}`} book={book} minutes={minutes ?? null} onSave={onSave} />}
    </BottomSheet>
  )
}

function PageForm({
  book,
  minutes: initialMinutes,
  onSave,
}: {
  book: Item
  minutes: number | null
  onSave: (page: number, minutes: number | null) => void
}) {
  const [page, setPage] = useState(String(book.progress || ''))
  const [minutes, setMinutes] = useState(initialMinutes ? String(initialMinutes) : '')
  const total = book.progress_total
  const n = Number(page)
  const m = Number(minutes)
  const mins = Number.isInteger(m) && m > 0 ? m : null
  const pageOk = page !== '' && Number.isInteger(n) && n >= 0 && (total == null || n <= total)
  // Se guarda si cambia la página o, con la misma página, si hay minutos.
  const valid = pageOk && (n !== book.progress || mins != null)
  const inputClass =
    'w-full rounded-xl bg-background px-3 py-2.5 text-ink ring-1 ring-primary-dark/40 focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave(n, mins)
      }}
      data-tracker="libros"
    >
      <p className="mb-3 text-sm text-lavender">
        {initialMinutes ? `Leíste ${initialMinutes} min. ` : ''}Vas en la página {book.progress}
        {total ? ` de ${total}` : ''}.
      </p>
      <div className="flex gap-2">
        <label className="block flex-1">
          <span className="mb-1 block text-xs text-lavender">Voy en la página</span>
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            min={0}
            max={total ?? undefined}
            value={page}
            onChange={(e) => setPage(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block w-28">
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
      <button
        type="submit"
        disabled={!valid}
        className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-background disabled:opacity-50"
      >
        {pageOk && n === book.progress && mins != null ? 'Guardar solo el tiempo' : 'Guardar'}
      </button>
    </form>
  )
}
