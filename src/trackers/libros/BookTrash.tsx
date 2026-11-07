import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { PageContainer } from '../../components/PageContainer'
import { TrackerBar } from '../../components/TrackerBar'
import { GameThumb } from '../../components/GameThumb'
import { Skeleton } from '../../components/Skeleton'
import { useTrash } from '../../hooks/useTrash'
import { haptic } from '../../lib/haptics'
import { mediaSections } from '../../lib/media'
import { TRASH_DAYS, trashDaysLabel } from '../../lib/trash'
import type { Item } from '../../types/item'

const section = mediaSections.libros

/**
 * Papelera de Libros: lo que borraste en los últimos 30 días, para restaurar
 * o eliminar para siempre.
 */
export function BookTrash() {
  const { trashAvailable, restoreItem, deleteItem } = useMedia()
  const { items, failed, forget, empty } = useTrash(trashAvailable)
  const { showToast, showError } = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)

  async function handleRestore(book: Item) {
    haptic()
    setBusy(book.id)
    try {
      await restoreItem(book.id)
      forget(book.id)
      showToast(`${book.title} volvió a tu librero`)
    } catch (err) {
      showError(err, 'No se pudo restaurar')
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(book: Item) {
    const ok = await confirm({
      title: `¿Eliminar ${book.title} para siempre?`,
      message: 'Se borra junto con su historial de lectura y no se puede deshacer.',
      confirmLabel: 'Eliminar para siempre',
      danger: true,
    })
    if (!ok) return
    haptic()
    setBusy(book.id)
    try {
      await deleteItem(book.id)
      forget(book.id)
      showToast(`${book.title} eliminado`)
    } catch (err) {
      showError(err, 'No se pudo eliminar')
    } finally {
      setBusy(null)
    }
  }

  async function handleEmpty() {
    const ok = await confirm({
      title: '¿Vaciar la papelera?',
      message: `Se eliminan para siempre ${items?.length ?? 0} libros, con su historial de lectura. No se puede deshacer.`,
      confirmLabel: 'Vaciar papelera',
      danger: true,
    })
    if (!ok) return
    haptic()
    setBusy('all')
    try {
      await empty()
      showToast('Papelera vaciada')
    } catch (err) {
      showError(err, 'No se pudo vaciar la papelera')
    } finally {
      setBusy(null)
    }
  }

  return (
    <PageContainer>
      <TrackerBar tracker="libros" />
      <Link
        to={section.libraryPath}
        className="-ml-2 mb-2 flex min-h-11 w-fit items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/15"
      >
        <ArrowLeft size={16} /> Librero
      </Link>
      <h1 className="text-3xl font-bold text-ink">Papelera</h1>
      <p className="mb-4 text-sm text-lavender">
        Los libros que borras quedan {TRASH_DAYS} días acá. Después se eliminan solos.
      </p>

      {!trashAvailable ? (
        <p className="font-book mt-8 text-center text-sm text-lavender">
          La papelera todavía no está activada en tu base de datos (falta la migración 0015). Por ahora, borrar un libro lo
          elimina para siempre.
        </p>
      ) : items == null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : failed && items.length === 0 ? (
        <p className="font-book mt-8 text-center text-sm text-error">No se pudo cargar la papelera.</p>
      ) : items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-3xl bg-background-surface p-8 text-center ring-1 ring-primary-dark/15">
          <Trash2 size={28} className="text-lavender" />
          <p className="text-sm text-lavender">La papelera está vacía.</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((book) => {
              const working = busy === book.id || busy === 'all'
              return (
                <li
                  key={book.id}
                  className="flex items-center gap-3 rounded-2xl bg-background-surface p-2.5 ring-1 ring-primary-dark/15"
                >
                  <GameThumb
                    size="thumb"
                    src={book.cover_url}
                    alt=""
                    className="h-16 w-11 shrink-0 rounded-[3px] object-cover shadow-sm"
                    placeholderClassName="text-lg"
                    icon={BookOpen}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-book truncate text-sm font-semibold text-ink">{book.title}</p>
                    <p className="truncate text-xs text-lavender">{book.metadata.authors?.join(', ') || 'Sin autor'}</p>
                    <p className="text-[11px] text-lavender/80">
                      {book.deleted_at ? trashDaysLabel(book.deleted_at) : ''}
                    </p>
                  </div>
                  {working ? (
                    <Loader2 size={18} className="mr-3 animate-spin text-lavender" />
                  ) : (
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => handleRestore(book)}
                        className="flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-semibold text-white active:scale-95"
                      >
                        <RotateCcw size={14} /> Restaurar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(book)}
                        aria-label={`Eliminar ${book.title} para siempre`}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-error active:bg-error/10"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={handleEmpty}
            disabled={busy != null}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-error ring-1 ring-error/40 active:bg-error/10 disabled:opacity-60"
          >
            <Trash2 size={15} /> Vaciar la papelera
          </button>
        </>
      )}
    </PageContainer>
  )
}
