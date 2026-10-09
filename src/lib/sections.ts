// Secciones de la biblioteca. Cada una tiene su propia pantalla; la barra
// inferior vuelve a la última que se usó.

import { BookOpen, Gamepad2, Tv, type LucideIcon } from 'lucide-react'

export type Section = 'juegos' | 'pantalla' | 'libros'

export const sections: Section[] = ['juegos', 'pantalla', 'libros']

const SECTION_KEY = 'shelflife_section'

export const sectionInfo: Record<
  Section,
  { label: string; Icon: LucideIcon; library: string; add: string; addLabel: string }
> = {
  juegos: { label: 'Juegos', Icon: Gamepad2, library: '/', add: '/add', addLabel: 'Agregar juego' },
  pantalla: {
    label: 'Pantalla',
    Icon: Tv,
    library: '/pantalla',
    add: '/pantalla/agregar',
    addLabel: 'Agregar película o serie',
  },
  libros: {
    label: 'Libros',
    Icon: BookOpen,
    library: '/libros',
    add: '/libros/agregar',
    addLabel: 'Agregar libro',
  },
}

/** Sección a la que pertenece una ruta (null si es común: listas, inicio...). */
export function sectionForPath(pathname: string): Section | null {
  if (pathname.startsWith('/pantalla')) return 'pantalla'
  if (pathname.startsWith('/libros')) return 'libros'
  if (
    pathname === '/' ||
    pathname.startsWith('/add') ||
    pathname.startsWith('/game/') ||
    pathname.startsWith('/steam-import')
  ) {
    return 'juegos'
  }
  return null
}

export function readLastSection(): Section {
  try {
    const value = localStorage.getItem(SECTION_KEY)
    return value && (sections as string[]).includes(value) ? (value as Section) : 'juegos'
  } catch {
    return 'juegos'
  }
}

export function saveLastSection(section: Section) {
  try {
    localStorage.setItem(SECTION_KEY, section)
  } catch {
    /* preferencia no persistida */
  }
}
