import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ClipboardList, Globe, Plus, Trash2 } from 'lucide-react'
import { useLists } from '../hooks/useLists'
import { PageContainer } from '../components/PageContainer'
import { Skeleton } from '../components/Skeleton'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { listPaths } from '../lib/listPaths'

/**
 * Mis listas: comunes a los tres trackers (una lista puede mezclar juegos,
 * películas y libros). Se llega desde el inicio y desde Juegos.
 */
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
      message: 'Lo que tiene sigue en tu biblioteca; solo se borra la lista.',
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
      <Link
        to="/"
        className="-ml-2 mb-2 flex min-h-11 w-fit items-center gap-1 rounded-full pl-1 pr-3 text-sm text-lavender active:bg-primary-dark/20"
      >
        <ChevronLeft size={18} /> Inicio
      </Link>
      <h1 className="text-3xl font-bold text-ink">Mis listas</h1>
      <p className="mb-4 text-sm text-lavender">Juegos, películas, series y libros, como quieras agruparlos</p>

      <form onSubmit={handleCreate} className="mb-5 flex gap-2 md:max-w-md">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva lista, ej. Para las vacaciones"
          aria-label="Nombre de la nueva lista"
          enterKeyHint="done"
          className="min-w-0 flex-1 rounded-xl bg-background-surface px-3 py-2.5 text-sm text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          aria-label="Crear lista"
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-accent px-4 text-sm font-semibold text-background disabled:opacity-40"
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
          <p className="max-w-xs text-sm text-lavender">
            Todavía no creaste ninguna lista. Úsalas para agrupar lo que quieras: "Para ver con amigos", "Clásicos
            pendientes", "Todo Star Wars"...
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => (
          <div key={list.id} className="flex items-center rounded-xl bg-background-surface ring-1 ring-primary-dark/30">
            <Link
              to={listPaths.list(list.id)}
              className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-l-xl pl-4 active:bg-primary-dark/20"
            >
              <ClipboardList size={18} className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{list.name}</span>
              {list.is_public && <Globe size={14} aria-label="Pública" className="shrink-0 text-lavender" />}
              <ChevronRight size={16} className="shrink-0 text-lavender" />
            </Link>
            <button
              onClick={() => handleDelete(list.id, list.name)}
              aria-label={`Eliminar la lista ${list.name}`}
              className="flex h-14 w-12 shrink-0 items-center justify-center rounded-r-xl text-lavender active:bg-error/10 active:text-error"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
