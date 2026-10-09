import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Globe, Link2, Lock, Share2, X } from 'lucide-react'
import { useLists, useListItemIds } from '../hooks/useLists'
import { useGames } from '../hooks/useGames'
import { useMedia } from '../contexts/MediaContext'
import { GameThumb } from '../components/GameThumb'
import { Skeleton } from '../components/Skeleton'
import { PageContainer } from '../components/PageContainer'
import { BottomSheet } from '../components/BottomSheet'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { appUrl } from '../lib/appUrl'
import { listEntries, listSummary, type ListEntry } from '../lib/listEntries'
import { listPaths } from '../lib/listPaths'
import { mediaTypeIcons } from '../lib/media'
import { trackers } from '../trackers/trackers'
import type { MediaType } from '../types/item'

const typeIcon = (type: MediaType) => (type === 'game' ? trackers.juegos.Icon : mediaTypeIcons[type])

/** Una lista: lo que tiene, de cualquier tracker, y compartirla por link. */
export function ListDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { lists, updateList } = useLists()
  const confirm = useConfirm()
  const [shareOpen, setShareOpen] = useState(false)
  const { itemIds, loading, removeItem, restoreItem } = useListItemIds(id)
  const { games } = useGames()
  const { items } = useMedia()
  const { showToast, showError } = useToast()

  const list = lists.find((l) => l.id === id)
  const entries = useMemo(() => listEntries(itemIds, games, items), [itemIds, games, items])

  const shareUrl = appUrl(`/compartir/${id}`)

  async function handleShare() {
    if (!list) return
    if (!list.is_public) {
      const ok = await confirm({
        title: 'Compartir la lista',
        message:
          'Cualquiera con el link podrá ver el nombre de la lista y lo que tiene (portada, estado y puntaje). Tus notas, reseñas y tiempos no se muestran. Puedes dejar de compartirla cuando quieras.',
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

  async function handleRemove(entry: ListEntry) {
    const index = itemIds.indexOf(entry.id)
    try {
      await removeItem(entry.id)
      showToast(`${entry.title} se quitó de la lista`, {
        duration: 5000,
        action: {
          label: 'Deshacer',
          onClick: () =>
            restoreItem(entry.id, index).catch((err: unknown) => showError(err, 'No se pudo volver a agregar')),
        },
      })
    } catch (err) {
      showError(err, 'No se pudo quitar')
    }
  }

  return (
    <PageContainer>
      <button
        onClick={() => navigate(listPaths.lists)}
        className="-ml-2 mb-2 flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/20"
      >
        <ArrowLeft size={16} /> Mis listas
      </button>

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-ink">{list?.name ?? 'Lista'}</h1>
          {!loading && (
            <p className="flex flex-wrap items-center gap-1 text-sm text-lavender">
              {listSummary(entries)}
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background-surface text-accent ring-1 ring-primary-dark/30 active:bg-primary-dark/20"
          >
            <Share2 size={18} />
          </button>
        )}
      </div>

      <BottomSheet open={shareOpen} onClose={() => setShareOpen(false)} title="Compartir lista">
        <p className="mb-3 text-sm text-lavender">
          Cualquiera con este link puede ver la lista (sin tus notas, reseñas ni tiempos).
        </p>
        <p className="mb-4 truncate rounded-xl bg-background/40 px-3 py-2.5 text-sm text-ink ring-1 ring-primary-dark/30">
          {shareUrl}
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={sendLink}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-background"
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

      {loading && (
        <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full" />
          ))}
        </div>
      )}

      {!loading && entries.length === 0 && (
        <p className="mt-8 text-center text-sm text-lavender">
          Esta lista está vacía. Agrega cosas desde el detalle de cada juego, película, serie o libro, en "Mis listas".
        </p>
      )}

      <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
        {entries.map((e) => (
          <div key={e.id} className="relative">
            <Link to={e.to} className="block transition-transform active:scale-[0.97]">
              <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-primary-dark/20 ring-1 ring-primary-dark/30">
                <GameThumb
                  src={e.cover}
                  alt=""
                  className="h-full w-full object-cover"
                  placeholderClassName="text-3xl"
                  icon={typeIcon(e.type)}
                />
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-tight text-ink">{e.title}</p>
              <p className="truncate text-[11px] text-lavender">
                {e.typeLabel} · {e.statusLabel}
              </p>
            </Link>
            <button
              onClick={() => handleRemove(e)}
              aria-label={`Quitar ${e.title} de la lista`}
              className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-ink shadow backdrop-blur after:absolute after:-inset-1.5 after:content-[''] active:text-error"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
