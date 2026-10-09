import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Globe, Link2, Lock, Share2, X } from 'lucide-react'
import { useLists, useListGameIds } from '../../hooks/useLists'
import { useGames } from '../../hooks/useGames'
import { GameCard } from '../../components/GameCard'
import { GameCardGridSkeleton } from '../../components/Skeleton'
import { PageContainer } from '../../components/PageContainer'
import { useToast } from '../../contexts/ToastContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { BottomSheet } from '../../components/BottomSheet'
import { plural } from '../../lib/text'
import type { Game } from '../../types/game'
import { appUrl } from '../../lib/appUrl'
import { gamesPaths } from './paths'

export function ListDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { lists, updateList } = useLists()
  const confirm = useConfirm()
  const [shareOpen, setShareOpen] = useState(false)
  const { gameIds, loading, removeGame, restoreGame } = useListGameIds(id)
  const { games } = useGames()
  const { showToast, showError } = useToast()

  const list = lists.find((l) => l.id === id)
  const listGames = useMemo(() => {
    const byId = new Map(games.map((g) => [g.id, g]))
    return gameIds.map((gameId) => byId.get(gameId)).filter((g): g is Game => g != null)
  }, [games, gameIds])

  const shareUrl = appUrl(`/compartir/${id}`)

  async function handleShare() {
    if (!list) return
    if (!list.is_public) {
      const ok = await confirm({
        title: 'Compartir la lista',
        message:
          'Cualquiera con el link podrá ver el nombre de la lista y sus juegos (portada, estado y puntaje). Tus notas, reseñas y horas no se muestran. Puedes dejar de compartirla cuando quieras.',
        confirmLabel: 'Crear link público',
      })
      if (!ok) return
      try {
        await updateList(list.id, { is_public: true })
      } catch (err) {
        showError(err, 'No se pudo compartir la lista')
        return
      }
    }
    setShareOpen(true)
  }

  async function sendLink() {
    try {
      if (navigator.share) {
        await navigator.share({ title: list?.name, url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        showToast('Link copiado')
      }
    } catch {
      /* menú de compartir cerrado */
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      showToast('Link copiado')
    } catch {
      showError(null, 'No se pudo copiar el link')
    }
  }

  async function stopSharing() {
    if (!list) return
    setShareOpen(false)
    try {
      await updateList(list.id, { is_public: false })
      showToast('La lista ya no es pública')
    } catch (err) {
      showError(err, 'No se pudo dejar de compartir')
    }
  }

  async function handleRemove(game: Game) {
    const index = gameIds.indexOf(game.id)
    try {
      await removeGame(game.id)
      showToast(`${game.title} se quitó de la lista`, {
        duration: 5000,
        action: {
          label: 'Deshacer',
          onClick: () =>
            restoreGame(game.id, index).catch((err) =>
              showError(err, 'No se pudo volver a agregar')
            ),
        },
      })
    } catch (err) {
      showError(err, 'No se pudo quitar el juego')
    }
  }

  return (
    <PageContainer>
      <button
        onClick={() => navigate(gamesPaths.lists)}
        className="-ml-2 mb-2 flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/20"
      >
        <ArrowLeft size={16} /> Mis listas
      </button>

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{list?.name ?? 'Lista'}</h1>
          {!loading && (
            <p className="flex items-center gap-1 text-sm text-lavender">
              {plural(listGames.length, 'juego')}
              {list?.is_public && (
                <>
                  {' · '}
                  <Globe size={13} /> Pública
                </>
              )}
            </p>
          )}
        </div>
        {list && (
          <button
            onClick={handleShare}
            aria-label="Compartir lista"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-background-surface text-accent ring-1 ring-primary-dark/30 active:bg-primary-dark/20"
          >
            <Share2 size={18} />
          </button>
        )}
      </div>

      <BottomSheet open={shareOpen} onClose={() => setShareOpen(false)} title="Compartir lista">
        <p className="mb-3 text-sm text-lavender">
          Cualquiera con este link puede ver la lista (sin tus notas, reseñas ni horas).
        </p>
        <p className="mb-4 truncate rounded-xl bg-background/40 px-3 py-2.5 text-sm text-ink ring-1 ring-primary-dark/30">
          {shareUrl}
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={sendLink}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white"
          >
            <Share2 size={18} /> Enviar link
          </button>
          <button
            onClick={copyLink}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-background/40 font-medium text-ink ring-1 ring-primary-dark/30"
          >
            <Link2 size={18} /> Copiar link
          </button>
          <button
            onClick={stopSharing}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl font-medium text-error active:bg-error/10"
          >
            <Lock size={16} /> Dejar de compartir
          </button>
        </div>
      </BottomSheet>

      {loading && <GameCardGridSkeleton count={3} />}

      {!loading && listGames.length === 0 && (
        <p className="mt-8 text-center text-sm text-lavender">
          Esta lista todavía no tiene juegos. Agrégalos desde el detalle de cada juego, en la
          sección "Mis listas".
        </p>
      )}

      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {listGames.map((game) => (
          <div key={game.id} className="relative">
            <GameCard
              game={game}
              onClick={(g) => navigate(gamesPaths.game(g.id))}
              className="pr-11"
            />
            <button
              onClick={() => handleRemove(game)}
              aria-label={`Quitar ${game.title} de la lista`}
              className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full text-lavender active:bg-error/10 active:text-error"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
