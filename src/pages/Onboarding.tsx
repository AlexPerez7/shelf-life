import { BarChart3, ClipboardList, Download } from 'lucide-react'

const features = [
  {
    Icon: ClipboardList,
    title: 'Gestiona tu biblioteca',
    description:
      'Juegos, películas, series y anime en un solo lugar: lo pendiente, lo que estás jugando o viendo y lo que ya terminaste.',
  },
  {
    Icon: Download,
    title: 'Importa desde Steam',
    description:
      'Trae tu biblioteca de Steam en segundos, con las horas jugadas reales de cada juego.',
  },
  {
    Icon: BarChart3,
    title: 'Sigue tu progreso',
    description:
      'Suma episodios con un toque, registra tus horas de juego y mira tus estadísticas.',
  },
]

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  return (
    <div
      className="flex min-h-dvh flex-col px-6"
      style={{
        paddingTop: 'calc(3rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex flex-1 flex-col items-center">
        <img
          src="/icons/icon-192.png"
          alt="Shelf Life"
          className="h-24 w-24 rounded-3xl shadow-lg shadow-black/40"
        />

        <p className="mt-6 text-sm text-lavender">Bienvenido a</p>
        <h1 className="text-4xl font-bold text-accent">Shelf Life</h1>

        <div className="mt-10 flex w-full max-w-sm flex-col gap-6">
          {features.map(({ Icon, title, description }) => (
            <div key={title} className="flex items-start gap-4">
              <Icon className="mt-0.5 shrink-0 text-accent" size={24} />
              <div>
                <h2 className="font-semibold text-ink">{title}</h2>
                <p className="mt-0.5 text-sm text-lavender">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onFinish}
        className="w-full max-w-sm self-center rounded-full bg-primary py-3.5 font-semibold text-white"
      >
        Empezar
      </button>
    </div>
  )
}
