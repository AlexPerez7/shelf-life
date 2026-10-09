import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Gamepad2, Tv, type LucideIcon } from 'lucide-react'
import { saveLastSection, sectionPaths, type Section } from '../lib/sections'

const tabs: { section: Section; label: string; Icon: LucideIcon }[] = [
  { section: 'juegos', label: 'Juegos', Icon: Gamepad2 },
  { section: 'pantalla', label: 'Pantalla', Icon: Tv },
]

/** Selector de sección arriba de cada biblioteca. */
export function SectionTabs({ current }: { current: Section }) {
  useEffect(() => saveLastSection(current), [current])

  return (
    <nav
      aria-label="Secciones"
      className="mb-4 flex rounded-full bg-background-surface p-1 ring-1 ring-primary-dark/30 md:max-w-xs"
    >
      {tabs.map(({ section, label, Icon }) => (
        <NavLink
          key={section}
          to={sectionPaths[section].library}
          end
          aria-current={section === current ? 'page' : undefined}
          className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors ${
            section === current ? 'bg-accent text-primary-darker' : 'text-lavender active:text-ink'
          }`}
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
