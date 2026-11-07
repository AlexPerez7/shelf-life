import { Link } from 'react-router-dom'
import { ClipboardList, Home, type LucideIcon } from 'lucide-react'
import { trackerIds, trackers } from '../trackers/trackers'
import { listPaths } from '../lib/listPaths'

interface Item {
  to: string
  label: string
  Icon: LucideIcon
  current?: boolean
}

/**
 * Barra inferior del inicio: Inicio, los tres trackers y Listas, siempre a
 * un toque. Fondo opaco (sin blur: va fija mientras se hace scroll).
 */
export function HomeNav() {
  const items: Item[] = [
    { to: '/', label: 'Inicio', Icon: Home, current: true },
    ...trackerIds.map((id) => ({ to: trackers[id].base, label: trackers[id].label, Icon: trackers[id].Icon })),
    { to: listPaths.lists, label: 'Listas', Icon: ClipboardList },
  ]
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border-t border-primary-dark/30 bg-background-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md gap-1 px-2.5 pb-2 pt-2 md:max-w-3xl lg:max-w-5xl">
        {items.map(({ to, label, Icon, current }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              aria-current={current ? 'page' : undefined}
              className={`flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] ${
                current ? 'bg-accent/15 font-semibold text-accent' : 'font-medium text-lavender active:bg-primary-dark/20'
              }`}
            >
              <Icon size={22} strokeWidth={1.8} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
