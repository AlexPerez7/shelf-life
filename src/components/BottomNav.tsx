import { NavLink, useLocation } from 'react-router-dom'
import { BarChart3, ClipboardList, Gamepad2, Home, Plus, Tv, type LucideIcon } from 'lucide-react'
import { readLastSection, sectionForPath, sectionPaths } from '../lib/sections'

interface NavItem {
  to: string
  label: string
  Icon: LucideIcon
  /** Activo según la ruta (si no, el criterio de NavLink). */
  active?: boolean
}

const right: NavItem[] = [
  { to: '/lists', label: 'Listas', Icon: ClipboardList },
  { to: '/dashboard', label: 'Estadísticas', Icon: BarChart3 },
]

function NavItemLink({ to, label, Icon, active }: NavItem) {
  return (
    <li className="flex-1 list-none">
      <NavLink
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
          `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] transition-colors ${
            (active ?? isActive) ? 'text-accent' : 'text-lavender active:text-ink'
          }`
        }
      >
        <Icon size={20} />
        {label}
      </NavLink>
    </li>
  )
}

export function BottomNav() {
  const { pathname } = useLocation()
  // "Biblioteca" y "+" apuntan a la sección en la que se está (o a la última
  // usada, desde las pantallas comunes como Listas).
  const pathSection = sectionForPath(pathname)
  const section = pathSection ?? readLastSection()
  const left: NavItem[] = [
    { to: '/home', label: 'Inicio', Icon: Home },
    {
      to: sectionPaths[section].library,
      label: 'Biblioteca',
      Icon: section === 'pantalla' ? Tv : Gamepad2,
      active: pathSection != null && !pathname.endsWith(sectionPaths[section].add),
    },
  ]

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 z-30 px-4"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <ul className="mx-auto flex max-w-md items-center rounded-full bg-background-surface/95 px-2 py-1 shadow-lg shadow-black/40 ring-1 ring-primary-dark/30 backdrop-blur md:max-w-3xl lg:max-w-5xl">
        {left.map((item) => (
          <NavItemLink key={item.to} {...item} />
        ))}

        {/* Acción principal: botón flotante central, más fácil de alcanzar
            con el pulgar que un ítem más de la barra. */}
        <li className="flex flex-1 list-none justify-center">
          <NavLink
            to={sectionPaths[section].add}
            aria-label={section === 'pantalla' ? 'Agregar película o serie' : 'Agregar juego'}
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
          <NavItemLink key={item.to} {...item} />
        ))}
      </ul>
    </nav>
  )
}
