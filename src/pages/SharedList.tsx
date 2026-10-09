import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { statusColors, statusLabels } from '../lib/status'
import { gameStatusFromItem } from '../lib/gameItem'
import { plural } from '../lib/text'
import { GameThumb } from '../components/GameThumb'
import { Skeleton } from '../components/Skeleton'
import type { GameStatus } from '../types/game'
import type { ItemStatus, MediaType } from '../types/item'
import { asset } from '../lib/appUrl'

/** Lo que devuelve `get_public_list` por cada ítem (migración 0011). */
interface PublicItem {
  media_type: MediaType
  title: string
  cover_url: string | null
  platforms: string[]
  genres: string[]
  status: ItemStatus
  rating: number | null
  release_date: string | null
}

interface PublicGame {
  title: string
  cover_url: string | null
  status: GameStatus
}

interface PublicList {
  name: string
  games: PublicGame[]
}

function toPublicList(data: { name: string; items: PublicItem[] }): PublicList {
  return {
    name: data.name,
    games: data.items
      .filter((i) => i.media_type === 'game')
      .map((i) => ({
        title: i.title,
        cover_url: i.cover_url,
        status: gameStatusFromItem(i.status),
      })),
  }
}

/**
 * Vista pública (sin login) de una lista compartida. Lee vía la función
 * `get_public_list`, que solo devuelve campos no sensibles de listas públicas.
 */
export function SharedList() {
  const { id } = useParams<{ id: string }>()
  const [list, setList] = useState<PublicList | null | undefined>(undefined)

  useEffect(() => {
    if (!id) return
    supabase
      .rpc('get_public_list', { p_list_id: id })
      .then(({ data, error }) =>
        setList(error || !data ? null : toPublicList(data as { name: string; items: PublicItem[] }))
      )
  }, [id])

  return (
    <div
      className="mx-auto max-w-md px-4 md:max-w-3xl"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
      }}
    >
      <Link to="/" className="mb-6 flex items-center gap-2">
        <img src={asset('icons/icon-192.png')} alt="" className="h-8 w-8 rounded-lg" />
        <span className="font-bold text-accent">Shelf Life</span>
      </Link>

      {list === undefined && (
        <>
          <Skeleton className="mb-4 h-7 w-2/3" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full" />
            ))}
          </div>
        </>
      )}

      {list === null && (
        <div className="mt-12 flex flex-col items-center gap-2 text-center">
          <ClipboardList size={32} className="text-lavender/60" />
          <p className="text-ink">Esta lista no existe o ya no está compartida.</p>
        </div>
      )}

      {list && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-lavender">
            Lista compartida
          </p>
          <h1 className="mb-1 text-2xl font-bold text-ink">{list.name}</h1>
          <p className="mb-5 text-sm text-lavender">{plural(list.games.length, 'juego')}</p>

          <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
            {list.games.map((g, i) => (
              <div key={`${g.title}-${i}`}>
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-primary-dark/20 ring-1 ring-primary-dark/30">
                  <GameThumb
                    src={g.cover_url}
                    alt=""
                    className="h-full w-full object-cover"
                    placeholderClassName="text-3xl"
                  />
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-tight text-ink">
                  {g.title}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] ${statusColors[g.status]}`}
                >
                  {statusLabels[g.status]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <Link
        to="/"
        className="mt-10 flex min-h-12 items-center justify-center rounded-xl bg-primary font-semibold text-white"
      >
        Arma tu propia biblioteca en Shelf Life
      </Link>
    </div>
  )
}
