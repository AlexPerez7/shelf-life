import { BarChart3, Bookmark, Play } from 'lucide-react'
import { TrackerNav, type TrackerNavItem } from '../components/TrackerNav'
import type { MediaSection } from '../lib/media'
import type { ItemStatus } from '../types/item'

/**
 * Barra inferior de Pantalla: la biblioteca completa, atajos a lo que se está
 * viendo y a lo que se quiere ver, y las estadísticas.
 */
export function MediaTrackerNav({ section }: { section: MediaSection }) {
  const base = section.libraryPath
  const shortcut = (status: ItemStatus, label: string, Icon: TrackerNavItem['Icon']): TrackerNavItem => ({
    to: `${base}?estado=${status}`,
    label,
    Icon,
    isActive: (pathname, search) => pathname === base && search.get('estado') === status,
  })
  const shortcuts: ItemStatus[] = ['in_progress', 'wishlist']
  const statsPath = `${base}/estadisticas`
  const historyPath = `${base}/historial`
  const isStats = (pathname: string) => pathname === statsPath || pathname === historyPath

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
              : pathname.startsWith(`${base}/`) && pathname !== section.addPath && !isStats(pathname),
        },
        shortcut('in_progress', section.statusLabels.in_progress, Play),
      ]}
      right={[
        shortcut('wishlist', section.statusLabels.wishlist, Bookmark),
        { to: statsPath, label: 'Estadísticas', Icon: BarChart3, isActive: isStats },
      ]}
      add={{ to: section.addPath, label: `Agregar a ${section.title}` }}
    />
  )
}
