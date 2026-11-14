// Barra de la edición en lote del librero: con libros elegidos, cambia su
// estado o su formato, o los manda a la papelera.

import { useState } from 'react'
import { Tags, Trash2, ListChecks } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { useToast } from '../../contexts/ToastContext'
import { BottomSheet } from '../../components/BottomSheet'
import { FormatPicker } from '../../components/FormatPicker'
import { ItemStatusSheet } from '../../components/ItemStatusSheet'
import { mediaSections } from '../../lib/media'
import { todayISO } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { BOOK_FORMATS } from '../../lib/formats'
import { batchFormatChanges, batchStatusChanges, type BatchChange } from '../../lib/bookBatch'
import { TRASH_DAYS } from '../../lib/trash'
import type { Item, ItemStatus } from '../../types/item'

const section = mediaSections.libros

const plural = (n: number) => `${n} ${n === 1 ? 'libro' : 'libros'}`

/** El valor que comparten todos, o null si difieren. */
function common<T>(values: T[]): T | null {
  return values.length > 0 && values.every((v) => v === values[0]) ? values[0] : null
}

/** Hoja para elegir el formato que se deja en los libros elegidos. */
function FormatSheet({
  open,
  onClose,
  count,
  initial,
  onApply,
}: {
  open: boolean
  onClose: () => void
  count: number
  initial: string
  onApply: (format: string) => void
}) {
  const [format, setFormat] = useState(initial)
  return (
    <BottomSheet open={open} onClose={onClose} title="Cambiar formato">
      <p className="mb-3 text-sm text-lavender">
        Reemplaza el formato de {plural(count)}. Sin ninguno marcado, se les quita.
      </p>
      <FormatPicker value={format} onChange={setFormat} options={BOOK_FORMATS} />
      <button
        type="button"
        onClick={() => onApply(format)}
        className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-white"
      >
        Aplicar a {plural(count)}
      </button>
    </BottomSheet>
  )
}

/**
 * `books` son los libros elegidos. Al terminar una acción se llama a
 * `onDone` (sale del modo selección).
 */
export function BookBatchBar({ books, onDone }: { books: Item[]; onDone: () => void }) {
  const { updateItem, trashAvailable, trashItem, restoreItem, deleteItem } = useMedia()
  const confirm = useConfirm()
  const { showToast, showError } = useToast()
  const [sheet, setSheet] = useState<'status' | 'format' | null>(null)
  const [busy, setBusy] = useState(false)
  const count = books.length

  /** Guarda los cambios de a uno (son optimistas); cuenta los que fallaron. */
  async function apply(changes: BatchChange[], doneMessage: string) {
    setSheet(null)
    if (changes.length === 0) {
      showToast('Ya estaban así')
      onDone()
      return
    }
    haptic()
    setBusy(true)
    const results = await Promise.allSettled(changes.map((c) => updateItem(c.id, c.changes)))
    setBusy(false)
    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length === 0) showToast(doneMessage)
    else showError((failed[0] as PromiseRejectedResult).reason, `No se pudieron guardar ${plural(failed.length)}`)
    onDone()
  }

  const changeStatus = (status: ItemStatus) => {
    const changes = batchStatusChanges(books, status, todayISO())
    return apply(changes, `${plural(changes.length)} pasaron a ${section.statusLabels[status]}`)
  }

  const changeFormat = (format: string) => {
    const changes = batchFormatChanges(books, format)
    return apply(
      changes,
      format.trim() ? `Formato de ${plural(changes.length)}: ${format}` : `Formato quitado a ${plural(changes.length)}`
    )
  }

  async function remove() {
    const ok = await confirm(
      trashAvailable
        ? {
            title: `¿Mandar ${plural(count)} a la papelera?`,
            message: `Salen de tu librero, tus listas y tus estadísticas. Quedan ${TRASH_DAYS} días en la papelera y los puedes restaurar.`,
            confirmLabel: 'Mandar a la papelera',
          }
        : {
            title: `¿Eliminar ${plural(count)}?`,
            message: 'Se borran de tu librero junto con su historial de lectura. No se puede deshacer.',
            confirmLabel: 'Eliminar',
            danger: true,
          }
    )
    if (!ok) return
    haptic()
    setBusy(true)
    const ids = books.map((b) => b.id)
    const results = await Promise.allSettled(ids.map((id) => (trashAvailable ? trashItem(id) : deleteItem(id))))
    setBusy(false)
    const done = ids.filter((_, i) => results[i].status === 'fulfilled')
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failed) showError(failed.reason, `No se pudieron borrar ${plural(ids.length - done.length)}`)
    if (done.length > 0) {
      if (trashAvailable) {
        showToast(`${plural(done.length)} en la papelera`, {
          duration: 6000,
          action: {
            label: 'Deshacer',
            onClick: () => {
              Promise.allSettled(done.map((id) => restoreItem(id))).then((r) => {
                const bad = r.find((x): x is PromiseRejectedResult => x.status === 'rejected')
                if (bad) showError(bad.reason, 'No se pudieron restaurar todos')
              })
            },
          },
        })
      } else {
        showToast(`${plural(done.length)} eliminados`)
      }
    }
    onDone()
  }

  const actions = [
    { label: 'Estado', Icon: ListChecks, onClick: () => setSheet('status') },
    { label: 'Formato', Icon: Tags, onClick: () => setSheet('format') },
    { label: 'Borrar', Icon: Trash2, onClick: remove },
  ]

  return (
    <>
      <div
        className="fixed inset-x-0 z-40 px-4"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-md items-center rounded-full bg-background-surface px-2 py-1 shadow-lg shadow-black/40 ring-1 ring-primary-dark/30 md:max-w-3xl lg:max-w-5xl">
          {actions.map(({ label, Icon, onClick }) => (
            <button
              key={label}
              type="button"
              disabled={count === 0 || busy}
              onClick={onClick}
              className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] text-accent disabled:text-lavender/50 active:bg-primary-dark/10"
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <ItemStatusSheet
        open={sheet === 'status'}
        onClose={() => setSheet(null)}
        value={common(books.map((b) => b.status))}
        onChange={changeStatus}
        labels={section.statusLabels}
        section={section}
        title={`Estado de ${plural(count)}`}
      />
      {/* key: al abrirla de nuevo parte del formato que comparten los elegidos. */}
      <FormatSheet
        key={`${sheet === 'format'}-${books.map((b) => b.id).join()}`}
        open={sheet === 'format'}
        onClose={() => setSheet(null)}
        count={count}
        initial={common(books.map((b) => b.format ?? '')) ?? ''}
        onApply={changeFormat}
      />
    </>
  )
}
