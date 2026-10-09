import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ClipboardList, Plus, Trash2 } from 'lucide-react'
import { useLists } from '../../hooks/useLists'
import { PageContainer } from '../../components/PageContainer'
import { TrackerBar } from '../../components/TrackerBar'
import { Skeleton } from '../../components/Skeleton'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { gamesPaths } from './paths'

export function Lists() {
  const { lists, loading, createList, deleteList } = useLists()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const { showToast, showError } = useToast()
  const confirm = useConfirm()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      await createList(name.trim())
      showToast(`Lista "${name.trim()}" creada`)
      setName('')
    } catch (err) {
      showError(err, 'No se pudo crear la lista')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string, listName: string) {
    const ok = await confirm({
      title: `¿Eliminar la lista "${listName}"?`,
      message: 'Los juegos siguen en tu biblioteca; solo se borra la lista.',
      confirmLabel: 'Eliminar lista',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteList(id)
    } catch (err) {
      showError(err, 'No se pudo eliminar la lista')
    }
  }

  return (
    <PageContainer>
      <TrackerBar tracker="juegos" />
      <h1 className="mb-4 text-xl font-semibold">Mis listas</h1>

      <form onSubmit={handleCreate} className="mb-5 flex gap-2 md:max-w-md">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva lista, ej. Para jugar en vacaciones"
          aria-label="Nombre de la nueva lista"
          enterKeyHint="done"
          className="min-w-0 flex-1 rounded-xl bg-background-surface px-3 py-2.5 text-sm text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          aria-label="Crear lista"
          className="flex min-h-11 flex-shrink-0 items-center gap-1 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          <Plus size={16} /> Crear
        </button>
      </form>

      {loading && (
        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {!loading && lists.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <ClipboardList size={32} className="text-lavender/60" />
          <p className="text-sm text-lavender">
            Todavía no creaste ninguna lista. Úsalas para agrupar juegos como "Favoritos de la
            infancia" o "Para jugar con amigos".
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => (
          <div
            key={list.id}
            className="flex items-center rounded-xl bg-background-surface ring-1 ring-primary-dark/30"
          >
            <Link
              to={gamesPaths.list(list.id)}
              className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-l-xl pl-4 active:bg-primary-dark/20"
            >
              <ClipboardList size={18} className="flex-shrink-0 text-lavender" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {list.name}
              </span>
              <ChevronRight size={16} className="flex-shrink-0 text-lavender" />
            </Link>
            <button
              onClick={() => handleDelete(list.id, list.name)}
              aria-label={`Eliminar la lista ${list.name}`}
              className="flex h-14 w-12 flex-shrink-0 items-center justify-center rounded-r-xl text-lavender active:bg-error/10 active:text-error"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
