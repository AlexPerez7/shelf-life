import { Bookmark, Play, Trophy } from 'lucide-react'
import { TrackerNav, type TrackerNavItem } from '../components/TrackerNav'
import type { MediaSection } from '../lib/media'
import type { ItemStatus } from '../types/item'

/**
 * Barra inferior de Pantalla y Libros: la biblioteca completa y atajos a los
 * estados que más se consultan (en curso, quiero, terminados).
 */
export function MediaTrackerNav({ section }: { section: MediaSection }) {
  const base = section.libraryPath
  const shortcut = (status: ItemStatus, label: string, Icon: TrackerNavItem['Icon']): TrackerNavItem => ({
    to: `${base}?estado=${status}`,
    label,
    Icon,
    isActive: (pathname, search) => pathname === base && search.get('estado') === status,
  })
  const shortcuts: ItemStatus[] = ['in_progress', 'wishlist', 'completed']

  return (
    <TrackerNav
      left={[
        {
          to: base,
          label: 'Biblioteca',
          Icon: section.Icon,
          // Activa en la biblioteca sin atajo y en los detalles.
          isActive: (pathname, search) =>
            pathname === base
              ? !shortcuts.includes(search.get('estado') as ItemStatus)
              : pathname.startsWith(`${base}/`) && pathname !== section.addPath,
        },
        shortcut('in_progress', section.statusLabels.in_progress, Play),
      ]}
      right={[
        shortcut('wishlist', section.statusLabels.wishlist, Bookmark),
        shortcut('completed', section.completedPlural, Trophy),
      ]}
      add={{ to: section.addPath, label: `Agregar a ${section.title}` }}
    />
  )
}
