import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { saveLastSection, sectionInfo, sections, type Section } from '../lib/sections'

/** Selector de sección arriba de cada biblioteca. */
export function SectionTabs({ current }: { current: Section }) {
  useEffect(() => saveLastSection(current), [current])

  return (
    <nav
      aria-label="Secciones"
      className="mb-4 flex rounded-full bg-background-surface p-1 ring-1 ring-primary-dark/30 md:max-w-sm"
    >
      {sections.map((section) => {
        const { label, Icon, library } = sectionInfo[section]
        return (
          <NavLink
            key={section}
            to={library}
            end
            aria-current={section === current ? 'page' : undefined}
            className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors ${
              section === current ? 'bg-accent text-primary-darker' : 'text-lavender active:text-ink'
            }`}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        )
      })}
    </nav>
  )
}
