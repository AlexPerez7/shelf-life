import { NavLink, useLocation } from 'react-router-dom'
import { Plus, type LucideIcon } from 'lucide-react'

export interface TrackerNavItem {
  to: string
  label: string
  Icon: LucideIcon
  /** Activo según la ruta actual (si no se pasa, el criterio de NavLink). */
  isActive?: (pathname: string, search: URLSearchParams) => boolean
}

interface TrackerNavProps {
  left: TrackerNavItem[]
  right: TrackerNavItem[]
  add: { to: string; label: string }
}

function NavItemLink({ item }: { item: TrackerNavItem }) {
  const location = useLocation()
  const custom = item.isActive?.(location.pathname, new URLSearchParams(location.search))
  return (
    <li className="flex-1 list-none">
      <NavLink
        to={item.to}
        end
        className={({ isActive }) =>
          `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] transition-colors ${
            (custom ?? isActive) ? 'text-accent' : 'text-lavender active:text-ink'
          }`
        }
      >
        <item.Icon size={20} />
        {item.label}
      </NavLink>
    </li>
  )
}

/** Barra inferior flotante de un tracker: dos ítems, "+" central, dos ítems. */
export function TrackerNav({ left, right, add }: TrackerNavProps) {
  return (
    <nav
      aria-label="Navegación del tracker"
      className="fixed inset-x-0 z-30 px-4"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <ul className="mx-auto flex max-w-md items-center rounded-full bg-background-surface/95 px-2 py-1 shadow-lg shadow-black/40 ring-1 ring-primary-dark/30 backdrop-blur md:max-w-3xl lg:max-w-5xl">
        {left.map((item) => (
          <NavItemLink key={item.to} item={item} />
        ))}

        {/* Acción principal: botón flotante central, más fácil de alcanzar
            con el pulgar que un ítem más de la barra. */}
        <li className="flex flex-1 list-none justify-center">
          <NavLink
            to={add.to}
            aria-label={add.label}
            className={({ isActive }) =>
              `-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-accent/30 ring-4 ring-background transition-transform active:scale-95 ${
                isActive ? 'scale-105' : ''
              }`
            }
          >
            <Plus size={26} strokeWidth={2.5} />
          </NavLink>
        </li>

        {right.map((item) => (
          <NavItemLink key={item.to} item={item} />
        ))}
      </ul>
    </nav>
  )
}
