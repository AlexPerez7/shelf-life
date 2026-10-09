// Secciones de la biblioteca. Cada una tiene su propia pantalla; la barra
// inferior vuelve a la última que se usó.

export type Section = 'juegos' | 'pantalla'

const SECTION_KEY = 'shelflife_section'

export const sectionPaths: Record<Section, { library: string; add: string }> = {
  juegos: { library: '/', add: '/add' },
  pantalla: { library: '/pantalla', add: '/pantalla/agregar' },
}

/** Sección a la que pertenece una ruta (null si es común: listas, inicio...). */
export function sectionForPath(pathname: string): Section | null {
  if (pathname.startsWith('/pantalla')) return 'pantalla'
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
    return localStorage.getItem(SECTION_KEY) === 'pantalla' ? 'pantalla' : 'juegos'
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
