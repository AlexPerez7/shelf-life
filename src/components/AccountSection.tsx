import { useState } from 'react'
import { Download, Loader2, LogOut, Sheet, UserRound } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useSignOut } from '../hooks/useSignOut'
import { useToast } from '../contexts/ToastContext'
import { deliverFile, exportCsv, exportJson } from '../lib/exportData'

/** Tu cuenta: el correo, cerrar sesión y exportar los datos (respaldo). Vive en Ajustes. */
export function AccountSection() {
  const { session } = useAuth()
  const signOut = useSignOut()
  const { showToast, showError } = useToast()
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null)

  async function handleExport(kind: 'json' | 'csv') {
    setExporting(kind)
    try {
      await deliverFile(kind === 'json' ? await exportJson() : await exportCsv(), kind)
      showToast('Exportación lista')
    } catch (err) {
      showError(err, 'No se pudo exportar')
    } finally {
      setExporting(null)
    }
  }

  async function handleSignOut() {
    const result = await signOut()
    if (result?.error) showError(result.error, 'No se pudo cerrar la sesión')
  }

  const buttonClass =
    'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-ink ring-1 ring-primary-dark/40 active:bg-primary-dark/20 disabled:opacity-50'

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-lavender">Tu cuenta</h2>
      <div className="rounded-2xl bg-background-surface p-3 ring-1 ring-primary-dark/30">
        <div className="mb-3 flex items-center gap-2">
          <UserRound size={18} className="shrink-0 text-lavender" />
          <p className="min-w-0 flex-1 truncate text-sm text-ink">{session?.user.email ?? '—'}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-error active:bg-error/10"
          >
            <LogOut size={16} /> Salir
          </button>
        </div>
        <p className="mb-2 text-xs text-lavender">Exporta todo como respaldo (o para llevarlo a otra app):</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => handleExport('json')} disabled={exporting != null} className={buttonClass}>
            {exporting === 'json' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Todo (JSON)
          </button>
          <button type="button" onClick={() => handleExport('csv')} disabled={exporting != null} className={buttonClass}>
            {exporting === 'csv' ? <Loader2 size={15} className="animate-spin" /> : <Sheet size={15} />} Biblioteca (CSV)
          </button>
        </div>
      </div>
    </section>
  )
}
