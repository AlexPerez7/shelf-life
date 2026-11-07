import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, PackageX, RefreshCw } from 'lucide-react'
import { PageContainer } from '../components/PageContainer'
import { AccountSection } from '../components/AccountSection'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { appVersion, buildDateLabel } from '../lib/appInfo'
import { checkForUpdate, consumeUpdated, markUpdated, reinstallApp } from '../lib/appUpdate'
import { haptic } from '../lib/haptics'

/**
 * Ajustes: tu cuenta (cerrar sesión, exportar) y la actualización de la app: la PWA no siempre toma una
 * versión nueva al abrirla, así que acá se fuerza la revisión y se recarga.
 */
export function Settings() {
  const { showToast, showError } = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState<'update' | 'reinstall' | null>(null)

  // Ya recargada después de actualizar: se avisa una vez.
  useEffect(() => {
    if (consumeUpdated()) showToast('Listo, ya tienes la última versión')
  }, [showToast])

  async function handleUpdate() {
    if (busy) return
    haptic()
    setBusy('update')
    try {
      const result = await checkForUpdate()
      if (result === 'new') {
        markUpdated()
        window.location.reload()
        return
      }
      showToast(
        result === 'current'
          ? 'Ya tienes la última versión'
          : result === 'pending'
            ? 'La actualización se está bajando: vuelve a tocar Actualizar en un momento'
            : 'Las actualizaciones solo funcionan en la app publicada o instalada'
      )
    } catch (err) {
      showError(err, navigator.onLine ? 'No se pudo buscar la actualización' : 'Sin conexión: no se pudo buscar la actualización')
    }
    setBusy(null)
  }

  async function handleReinstall() {
    if (busy) return
    const ok = await confirm({
      title: '¿Reinstalar los archivos de la app?',
      message:
        'Borra los archivos guardados en este dispositivo y los vuelve a bajar. Tus datos no se tocan, ni los cambios que estén esperando conexión. Necesitas señal para que la app vuelva a abrir.',
      confirmLabel: 'Reinstalar',
      danger: true,
    })
    if (!ok) return
    haptic()
    setBusy('reinstall')
    try {
      await reinstallApp()
      markUpdated()
      window.location.reload()
    } catch (err) {
      showError(err, 'No se pudo reinstalar')
      setBusy(null)
    }
  }

  const date = buildDateLabel()

  return (
    <PageContainer>
      <Link
        to="/"
        className="-ml-2 mb-2 flex min-h-11 w-fit items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/15"
      >
        <ArrowLeft size={16} /> Inicio
      </Link>
      <h1 className="mb-4 text-3xl font-bold text-ink">Ajustes</h1>

      <AccountSection />

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-lavender">La app</h2>
        <div className="rounded-2xl bg-background-surface p-4 ring-1 ring-primary-dark/30">
          <p className="text-sm text-ink">
            Versión <span className="font-mono tabular-nums">{appVersion}</span>
            {date && <span className="text-lavender"> · {date}</span>}
          </p>
          <p className="mt-1 text-xs text-lavender">
            Si publicaste cambios y todavía no los ves, toca Actualizar: busca la versión nueva y la instala. Si hay una,
            la app se reinicia sola.
          </p>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={busy != null}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-background transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy === 'update' ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            {busy === 'update' ? 'Buscando...' : 'Actualizar'}
          </button>
        </div>

        <div className="mt-3 rounded-2xl bg-background-surface p-4 ring-1 ring-primary-dark/30">
          <p className="text-sm font-medium text-ink">¿Sigue sin actualizarse?</p>
          <p className="mt-1 text-xs text-lavender">
            Borra los archivos guardados de la app y los baja de nuevo. Es el último recurso.
          </p>
          <button
            type="button"
            onClick={handleReinstall}
            disabled={busy != null}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium text-error ring-1 ring-error/40 active:bg-error/10 disabled:opacity-60"
          >
            {busy === 'reinstall' ? <Loader2 size={16} className="animate-spin" /> : <PackageX size={16} />}
            Reinstalar los archivos de la app
          </button>
        </div>
      </section>
    </PageContainer>
  )
}
