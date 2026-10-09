import { Check } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { itemStatusColor, itemStatusIcons, itemStatuses, type MediaSection } from '../lib/media'
import type { ItemStatus } from '../types/item'

interface ItemStatusSheetProps {
  open: boolean
  onClose: () => void
  value: ItemStatus
  onChange: (status: ItemStatus) => void
  /** Etiquetas de la sección ("Viendo", "Leyendo"...). */
  labels: Record<ItemStatus, string>
  /** Sección dueña de los estados (para sus colores propios). */
  section?: MediaSection
  title?: string
}

/** Como StatusSheet, pero para los estados genéricos de `items`. */
export function ItemStatusSheet({
  open,
  onClose,
  value,
  onChange,
  labels,
  section,
  title = 'Cambiar estado',
}: ItemStatusSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-1">
        {itemStatuses.map((s) => {
          const StatusIcon = itemStatusIcons[s]
          const active = s === value
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={`flex min-h-14 items-center gap-3 rounded-xl px-3 text-left ${
                active ? 'bg-accent/10' : 'active:bg-primary-dark/10'
              }`}
            >
              <span
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${itemStatusColor(s, section)}`}
              >
                <StatusIcon size={18} />
              </span>
              <span className={`flex-1 text-sm font-medium ${active ? 'text-accent' : 'text-ink'}`}>
                {labels[s]}
              </span>
              {active && <Check size={18} className="text-accent" />}
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}
