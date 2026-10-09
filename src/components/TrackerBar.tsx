import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { asset } from '../lib/appUrl'
import { trackers, type TrackerId } from '../trackers/trackers'

/**
 * Barra superior de las pantallas principales de un tracker: vuelve al
 * inicio de Shelf Life (donde se elige tracker) y muestra en cuál se está.
 */
export function TrackerBar({ tracker }: { tracker: TrackerId }) {
  const { label, Icon } = trackers[tracker]
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <Link
        to="/"
        aria-label="Volver al inicio de Shelf Life"
        className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-full pl-1 pr-3 text-sm text-lavender active:bg-primary-dark/20"
      >
        <ChevronLeft size={18} />
        <img src={asset('icons/icon-192.png')} alt="" className="h-6 w-6 rounded-md" />
        Shelf Life
      </Link>
      <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
        <Icon size={14} />
        {label}
      </span>
    </div>
  )
}
