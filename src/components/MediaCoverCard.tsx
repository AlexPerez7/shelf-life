import { Heart } from 'lucide-react'
import { GameThumb } from './GameThumb'
import {
  hasEpisodes,
  itemStatusColor,
  itemStatusIcons,
  screenStatusLabels,
  screenTypeIcons,
  screenTypeLabels,
} from '../lib/media'
import type { Item, ScreenType } from '../types/item'

interface MediaCoverCardProps {
  item: Item
  onClick: (item: Item) => void
  onStatusClick?: (item: Item) => void
}

function subtitle(item: Item) {
  const type = item.media_type as ScreenType
  const year = item.release_date?.slice(0, 4)
  if (hasEpisodes(type) && (item.progress > 0 || item.progress_total)) {
    return `${screenTypeLabels[type]} · ${item.progress}/${item.progress_total ?? '?'}`
  }
  return [screenTypeLabels[type], year].filter(Boolean).join(' · ')
}

/** Tarjeta de película / serie / anime en la cuadrícula. */
export function MediaCoverCard({ item, onClick, onStatusClick }: MediaCoverCardProps) {
  const StatusIcon = itemStatusIcons[item.status]
  const showProgress = item.progress_total != null && item.progress > 0
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onClick(item)}
        className="block w-full text-left transition-transform active:scale-[0.97]"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-primary-dark/20 ring-1 ring-primary-dark/30">
          <GameThumb
            src={item.cover_url}
            alt=""
            className="h-full w-full object-cover"
            placeholderClassName="text-3xl"
            icon={screenTypeIcons[item.media_type as ScreenType]}
          />
          {showProgress && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
              <div
                className="h-full bg-accent"
                style={{ width: `${Math.min(100, (item.progress / item.progress_total!) * 100)}%` }}
              />
            </div>
          )}
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-tight text-ink">{item.title}</p>
        <p className="text-[11px] text-lavender">{subtitle(item)}</p>
      </button>

      {item.is_favorite && (
        <Heart
          size={16}
          fill="currentColor"
          aria-label="Favorito"
          className="pointer-events-none absolute left-1.5 top-1.5 text-accent drop-shadow"
        />
      )}
      <button
        type="button"
        onClick={() => onStatusClick?.(item)}
        disabled={!onStatusClick}
        aria-label={`Estado: ${screenStatusLabels[item.status]}. Cambiar`}
        className={`absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full shadow after:absolute after:-inset-1.5 after:content-[''] ${itemStatusColor(item.status)}`}
      >
        <StatusIcon size={15} />
      </button>
    </div>
  )
}
