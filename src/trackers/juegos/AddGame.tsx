import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SiSteam } from 'react-icons/si'
import { GameForm } from '../../components/GameForm'
import { PageContainer } from '../../components/PageContainer'
import { useGames } from '../../hooks/useGames'
import { useToast } from '../../contexts/ToastContext'
import type { NewGame } from '../../types/game'
import { gamesPaths } from './paths'

export function AddGame() {
  const { games, addGame } = useGames()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const existingIgdbIds = useMemo(
    () => new Set(games.map((g) => g.igdb_id).filter((id): id is number => id != null)),
    [games]
  )

  async function handleSubmit(game: NewGame) {
    const created = await addGame(game)
    showToast(`${created.title} agregado a tu biblioteca`)
    // Al detalle, para ajustar estado/progreso en el momento. `replace` para
    // que "volver" desde ahí no regrese a un formulario ya enviado.
    navigate(gamesPaths.game(created.id), { replace: true })
  }

  return (
    <PageContainer>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agregar juego</h1>
        <button
          onClick={() => navigate(gamesPaths.steamImport)}
          className="-mr-2 flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm text-accent active:bg-primary-dark/20"
        >
          <SiSteam size={16} />
          Importar de Steam →
        </button>
      </div>
      <div className="md:mx-auto md:max-w-md">
        <GameForm onSubmit={handleSubmit} existingIgdbIds={existingIgdbIds} />
      </div>
    </PageContainer>
  )
}
