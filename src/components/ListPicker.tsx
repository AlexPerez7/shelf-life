import { useState } from 'react'
import { Check, ClipboardList, Plus } from 'lucide-react'
import { useLists, useItemListIds } from '../hooks/useLists'
import { useToast } from '../contexts/ToastContext'
import { haptic } from '../lib/haptics'
import { SectionCard } from './SectionCard'
import { Chip } from './Chip'

/**
 * "Mis listas" en el detalle de un juego, película, serie o libro: tocar una
 * lista agrega o quita el ítem, y se puede crear una lista nueva ahí mismo
 * (que ya queda con el ítem adentro). Las listas son comunes a los tres
 * trackers.
 */
export function ListPicker({ itemId, inactiveClassName }: { itemId: string; inactiveClassName?: string }) {
  const { lists, createList } = useLists()
  const { listIds, toggle } = useItemListIds(itemId)
  const { showError } = useToast()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  async function handleToggle(listId: string) {
    haptic()
    try {
      await toggle(listId)
    } catch (err) {
      showError(err, 'No se pudo actualizar la lista')
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const list = await createList(trimmed)
      await toggle(list.id)
      setName('')
      setCreating(false)
    } catch (err) {
      showError(err, 'No se pudo crear la lista')
    }
  }

  return (
    <SectionCard icon={ClipboardList} title="Mis listas">
      <div className="flex flex-wrap gap-x-2 gap-y-3">
        {lists.map((list) => {
          const active = listIds.has(list.id)
          return (
            <Chip
              key={list.id}
              active={active}
              onClick={() => handleToggle(list.id)}
              inactiveClassName={inactiveClassName ?? 'bg-background/40 text-lavender ring-1 ring-primary-dark/30'}
            >
              {active ? <Check size={14} className="-ml-0.5 mr-1" /> : <Plus size={14} className="-ml-0.5 mr-1" />}
              {list.name}
            </Chip>
          )
        })}
        {!creating && (
          <Chip
            active={false}
            onClick={() => setCreating(true)}
            inactiveClassName="border border-dashed border-accent/50 text-accent"
          >
            <Plus size={14} className="-ml-0.5 mr-1" /> Nueva lista
          </Chip>
        )}
      </div>
      {creating && (
        <form onSubmit={handleCreate} className="mt-3 flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la lista"
            aria-label="Nombre de la nueva lista"
            enterKeyHint="done"
            className="min-w-0 flex-1 rounded-xl bg-background/40 px-3 py-2 text-sm text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="min-h-10 shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-background disabled:opacity-40"
          >
            Crear
          </button>
        </form>
      )}
    </SectionCard>
  )
}
