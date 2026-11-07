// Barra de acciones de la edición en lote del librero: cambiar el estado o el
// formato de los libros seleccionados, o mandarlos a la papelera.

import { useState } from 'react'
import { BookMarked, Tag, Trash2, X } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { BottomSheet } from '../../components/BottomSheet'
import { FormatPicker } from '../../components/FormatPicker'
import { ItemStatusSheet } from '../../components/ItemStatusSheet'
import { haptic } from '../../lib/haptics'
import { todayISO } from '../../lib/dates'
import { BOOK_FORMATS } from '../../lib/formats'
import { parseTags } from '../../lib/tags'
import { batchFormatChanges, batchStatusChanges } from '../../lib/bookBatch'
import { mediaSections } from '../../lib/media'
import type { Item, ItemStatus, ItemWrite } from '../../types/item'

const section = mediaSections.libros

interface BookSelectionBarProps {
  /** Los libros seleccionados. */
  books: Item[]
  /** Todos los libros de la vista están seleccionados. */
  allChecked: boolean
  onToggleAll: () => void
  /** Sale del modo selección. */
  onDone: () => void
}

export function BookSelectionBar({ books, allChecked, onToggleAll, onDone }: BookSelectionBarProps) {
  const { updateItem, deleteItem, trashItem, restoreItem, trashAvailable } = useMedia()
  const { showToast, showError } = useToast()
  const confirm = useConfirm()
  const [statusOpen, setStatusOpen] = useState(false)
  const [formatOpen, setFormatOpen] = useState(false)
  const [formats, setFormats] = useState('')
  const [busy, setBusy] = useState(false)

  const count = books.length
  const noun = count === 1 ? 'libro' : 'libros'
  const disabled = count === 0 || busy

  /** Aplica un cambio a cada libro (saltea los que ya lo tienen). Devuelve cuántos cambiaron. */
  async function applyChanges(change: (book: Item) => ItemWrite | null): Promise<number> {
    const pending = books.flatMap((book) => {
      const changes = change(book)
      return changes ? [{ book, changes }] : []
    })
    const results = await Promise.allSettled(pending.map(({ book, changes }) => updateItem(book.id, changes)))
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failed) showError(failed.reason, 'No se pudieron cambiar todos los libros')
    return results.filter((r) => r.status === 'fulfilled').length
  }

  async function changeStatus(status: ItemStatus) {
    setStatusOpen(false)
    setBusy(true)
    try {
      const today = todayISO()
      const changed = await applyChanges((book) => batchStatusChanges(book, status, today))
      haptic()
      showToast(
        changed === 0
          ? `Ya estaban en "${section.statusLabels[status]}"`
          : `${changed} ${changed === 1 ? 'libro pasó' : 'libros pasaron'} a "${section.statusLabels[status]}"`
      )
      onDone()
    } finally {
      setBusy(false)
    }
  }

  async function changeFormat() {
    setFormatOpen(false)
    setBusy(true)
    try {
      const picked = parseTags(formats)
      const changed = await applyChanges((book) => batchFormatChanges(book, picked))
      haptic()
      showToast(
        changed === 0
          ? 'Ya tenían ese formato'
          : picked.length
            ? `Formato "${picked.join(', ')}" en ${changed} ${changed === 1 ? 'libro' : 'libros'}`
            : `Formato quitado en ${changed} ${changed === 1 ? 'libro' : 'libros'}`
      )
      onDone()
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `¿Eliminar ${count} ${noun}?`,
      message: trashAvailable
        ? 'Van a la papelera y se pueden restaurar durante 30 días.'
        : 'Se eliminan para siempre, con su historial.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      const ids = books.map((b) => b.id)
      const results = await Promise.allSettled(ids.map((id) => (trashAvailable ? trashItem(id) : deleteItem(id))))
      const done = ids.filter((_, i) => results[i].status === 'fulfilled')
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failed) showError(failed.reason, 'No se pudieron eliminar todos los libros')
      if (done.length > 0) {
        const label = `${done.length} ${done.length === 1 ? 'libro' : 'libros'}`
        if (trashAvailable) {
          showToast(`${label} en la papelera`, {
            duration: 6000,
            action: {
              label: 'Deshacer',
              onClick: () =>
                Promise.all(done.map((id) => restoreItem(id))).catch((err) =>
                  showError(err, 'No se pudieron restaurar')
                ),
            },
          })
        } else {
          showToast(`${label} eliminados`)
        }
      }
      onDone()
    } finally {
      setBusy(false)
    }
  }

  const action =
    'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium disabled:opacity-40 active:bg-primary-dark/15'

  return (
    <>
      {/* Sobre la barra inferior del tracker (que va en z-30). Fondo opaco: nada de blur en lo fijo. */}
      <div
        role="toolbar"
        aria-label="Edición en lote"
        className="fixed inset-x-0 z-40 px-4"
        style={{ bottom: 'calc(5.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-md rounded-2xl bg-background-surface p-2 shadow-lg shadow-black/40 ring-1 ring-primary-dark/30 md:max-w-3xl lg:max-w-5xl">
          <div className="flex items-center gap-1 px-1 pb-1">
            <button
              type="button"
              onClick={onDone}
              aria-label="Salir de la selección"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-primary-dark/15"
            >
              <X size={20} />
            </button>
            <p className="flex-1 text-sm font-semibold text-ink" aria-live="polite">
              {count === 0 ? 'Toca los libros que quieras editar' : `${count} ${count === 1 ? 'seleccionado' : 'seleccionados'}`}
            </p>
            <button
              type="button"
              onClick={onToggleAll}
              className="min-h-11 rounded-full px-3 text-sm font-medium text-accent active:bg-primary-dark/15"
            >
              {allChecked ? 'Ninguno' : 'Todos'}
            </button>
          </div>
          <div className="flex gap-1">
            <button type="button" disabled={disabled} onClick={() => setStatusOpen(true)} className={`${action} text-ink`}>
              <BookMarked size={18} /> Estado
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                // Si todos comparten formato, arranca con ese marcado.
                const first = books[0]?.format ?? ''
                setFormats(books.every((b) => (b.format ?? '') === first) ? first : '')
                setFormatOpen(true)
              }}
              className={`${action} text-ink`}
            >
              <Tag size={18} /> Formato
            </button>
            <button type="button" disabled={disabled} onClick={remove} className={`${action} text-error`}>
              <Trash2 size={18} /> Eliminar
            </button>
          </div>
        </div>
      </div>

      <ItemStatusSheet
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        value={null}
        onChange={changeStatus}
        labels={section.statusLabels}
        section={section}
        title={`Cambiar estado de ${count} ${noun}`}
      />

      <BottomSheet open={formatOpen} onClose={() => setFormatOpen(false)} title={`Formato de ${count} ${noun}`}>
        <p className="mb-3 text-sm text-lavender">
          Reemplaza el formato de los libros seleccionados. Sin marcar ninguno, se les quita.
        </p>
        <FormatPicker value={formats} onChange={setFormats} options={BOOK_FORMATS} />
        <button
          type="button"
          onClick={changeFormat}
          className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-white active:opacity-90"
        >
          Aplicar
        </button>
      </BottomSheet>
    </>
  )
}
