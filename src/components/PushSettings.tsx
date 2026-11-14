import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { disablePush, enablePush, pushStatus, type PushStatus } from '../lib/push'
import { haptic } from '../lib/haptics'

/** Por qué no se pueden activar, para cada estado que lo impide. */
const BLOCKED: Partial<Record<PushStatus, string>> = {
  unsupported:
    'Este navegador no permite avisos. En iPhone, instala la app en la pantalla de inicio y ábrela desde ahí.',
  unconfigured: 'Esta versión de la app no tiene los avisos configurados.',
  denied: 'Bloqueaste las notificaciones de la app: puedes volver a permitirlas desde los ajustes del navegador.',
}

/**
 * "Avisos de episodios" en Ajustes: activa o apaga las notificaciones de este
 * dispositivo. El aviso lo manda la Edge Function `episode-alerts` el día que
 * sale un episodio de una serie o anime que sigues.
 */
export function PushSettings() {
  const { showToast, showError } = useToast()
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    pushStatus()
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus('unsupported'))
    return () => {
      cancelled = true
    }
  }, [])

  async function toggle() {
    if (busy || !status) return
    haptic()
    setBusy(true)
    try {
      if (status === 'on') {
        await disablePush()
        showToast('Avisos apagados en este dispositivo')
      } else {
        await enablePush()
        showToast('Te avisaremos cuando salga un episodio nuevo')
      }
      setStatus(await pushStatus())
    } catch (err) {
      showError(err, 'No se pudo cambiar los avisos')
      setStatus(await pushStatus().catch(() => 'unsupported' as const))
    }
    setBusy(false)
  }

  const blocked = status ? BLOCKED[status] : null

  return (
    <div className="mt-3 rounded-2xl bg-background-surface p-4 ring-1 ring-primary-dark/30">
      <p className="text-sm font-medium text-ink">Avisos de episodios</p>
      <p className="mt-1 text-xs text-lavender">
        Una notificación el día que sale un episodio de una serie o anime que sigues (en curso, en pausa o por ver).
      </p>
      {blocked ? (
        <p className="mt-3 text-xs text-lavender">{blocked}</p>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={busy || status == null}
          className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-60 ${
            status === 'on' ? 'text-ink ring-1 ring-primary-dark/40' : 'bg-accent font-semibold text-background'
          }`}
        >
          {busy || status == null ? (
            <Loader2 size={16} className="animate-spin" />
          ) : status === 'on' ? (
            <BellOff size={16} />
          ) : (
            <Bell size={16} />
          )}
          {status === 'on' ? 'Apagar avisos en este dispositivo' : 'Activar avisos en este dispositivo'}
        </button>
      )}
    </div>
  )
}
