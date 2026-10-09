import { Share2 } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'

interface YearRecapProps {
  year: number
  /** Primera línea del texto compartido (ej. "Mi 2026 en Shelf Life 📚"). */
  heading: string
  lines: string[]
}

/** Resumen del año, para compartir (menú nativo o portapapeles). */
export function YearRecap({ year, heading, lines }: YearRecapProps) {
  const { showToast } = useToast()
  if (lines.length === 0) return null

  async function share() {
    const text = [heading, ...lines].join('\n')
    try {
      if (navigator.share) {
        await navigator.share({ title: `Mi ${year} en Shelf Life`, text })
      } else {
        await navigator.clipboard.writeText(text)
        showToast('Resumen copiado al portapapeles')
      }
    } catch {
      /* el usuario cerró el menú de compartir */
    }
  }

  return (
    <div className="rounded-2xl bg-accent/10 p-4 ring-1 ring-accent/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Tu {year}</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-ink">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={share}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-background"
      >
        <Share2 size={16} /> Compartir resumen
      </button>
    </div>
  )
}
