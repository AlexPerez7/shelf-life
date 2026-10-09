import { Heart, Star } from 'lucide-react'
import { TagList } from './TagList'
import { GameThumb } from './GameThumb'
import { statusLabels, statusColors } from '../lib/status'
import type { Game } from '../types/game'

interface GameCardProps {
  game: Game
  onClick?: (game: Game) => void
  /** Tocar la etiqueta de estado (cambio rápido sin entrar al detalle). */
  onStatusClick?: (game: Game) => void
  className?: string
}

/**
 * Tarjeta de juego en modo lista. Toda la tarjeta abre el detalle; la
 * etiqueta de estado es un botón aparte (por eso la tarjeta no es un único
 * <button>: no se pueden anidar botones).
 */
export function GameCard({ game, onClick, onStatusClick, className = '' }: GameCardProps) {
  return (
    <div
      className={`relative flex w-full items-center gap-3 rounded-lg bg-background-surface p-3 text-left shadow-sm ring-1 ring-primary-dark/30 has-[>button:first-child:active]:scale-[0.99] ${className}`}
    >
      <button
        type="button"
        onClick={() => onClick?.(game)}
        aria-label={game.title}
        className="absolute inset-0 rounded-lg active:bg-primary-dark/10"
      />
      <div className="pointer-events-none h-20 w-14 flex-shrink-0 overflow-hidden rounded bg-primary-dark/20">
        <GameThumb
          size="thumb"
          src={game.cover_url}
          alt=""
          className="h-full w-full object-cover"
          placeholderClassName="text-2xl"
        />
      </div>
      <div className="pointer-events-none min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium text-ink">
          <span className="truncate">{game.title}</span>
          {game.is_favorite && (
            <Heart size={14} className="flex-shrink-0 text-accent" fill="currentColor" aria-label="Favorito" />
          )}
        </p>
        {game.platform ? (
          <div className="mt-0.5">
            <TagList value={game.platform} />
          </div>
        ) : (
          <p className="text-sm text-lavender">Sin plataforma</p>
        )}
        <div className="mt-1 flex items-center gap-2">
          {onStatusClick ? (
            <button
              type="button"
              onClick={() => onStatusClick(game)}
              aria-label={`Estado: ${statusLabels[game.status]}. Cambiar`}
              className={`pointer-events-auto relative z-10 rounded-full px-2 py-0.5 text-xs after:absolute after:-inset-2 after:content-[''] ${statusColors[game.status]}`}
            >
              {statusLabels[game.status]} ▾
            </button>
          ) : (
            <span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[game.status]}`}>
              {statusLabels[game.status]}
            </span>
          )}
          <span className="text-xs text-lavender">{game.hours_played}h</span>
          {game.rating != null && (
            <span className="flex items-center gap-0.5 text-xs text-lavender">
              <Star size={12} className="text-accent" fill="currentColor" />
              {game.rating}/10
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
