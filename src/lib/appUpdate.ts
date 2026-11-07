// Actualizar la app a mano. El service worker (vite-plugin-pwa, `autoUpdate`)
// baja la versión nueva en segundo plano y se activa solo, pero la pantalla
// abierta sigue con el código viejo hasta que se recarga, y el navegador
// revisa si hay algo nuevo pocas veces. Esto fuerza la revisión y recarga.

export type UpdateCheck =
  /** Había una versión nueva y ya está activa: falta recargar. */
  | 'new'
  /** Ya tenía la última. */
  | 'current'
  /** Se está bajando todavía (conexión lenta): conviene volver a intentar. */
  | 'pending'
  /** Sin service worker (desarrollo, o un navegador sin soporte). */
  | 'unsupported'

/** Lo que se usa del service worker, para poder probarlo. */
export interface SwContainer extends EventTarget {
  getRegistration(): Promise<
    | {
        update(): Promise<unknown>
        installing: unknown
        waiting: { postMessage(message: unknown): void } | null
      }
    | undefined
  >
}

/** Espera máxima a que la versión nueva tome el control. */
const TAKE_CONTROL_TIMEOUT_MS = 20_000

/**
 * Busca una versión nueva y, si la hay, espera a que tome el control (el
 * service worker nuevo se activa solo: `skipWaiting` + `clientsClaim`).
 * Lanza si no se pudo consultar (sin conexión).
 */
export async function checkForUpdate(
  sw: SwContainer | undefined = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined,
  timeoutMs = TAKE_CONTROL_TIMEOUT_MS
): Promise<UpdateCheck> {
  if (!sw) return 'unsupported'
  const registration = await sw.getRegistration()
  if (!registration) return 'unsupported'

  // Se escucha antes de pedir la revisión: la versión nueva puede tomar el
  // control antes de que `update()` responda.
  let changed = false
  let notify: (() => void) | null = null
  const onChange = () => {
    changed = true
    notify?.()
  }
  sw.addEventListener('controllerchange', onChange)
  try {
    await registration.update()
    if (!changed && !registration.installing && !registration.waiting) return 'current'
    // Si quedó esperando (no debería con `skipWaiting`), se le pide pasar.
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
    if (!changed) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, timeoutMs)
        notify = () => {
          clearTimeout(timer)
          resolve()
        }
      })
    }
    return changed ? 'new' : 'pending'
  } finally {
    sw.removeEventListener('controllerchange', onChange)
  }
}

/**
 * Último recurso si la app no toma los cambios: desregistra el service worker
 * y borra los archivos guardados (Cache Storage). No toca los datos: están en
 * Supabase, y los cambios sin conexión pendientes, en el almacenamiento local.
 */
export async function reinstallApp(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((r) => r.unregister()))
  }
  if (typeof caches !== 'undefined') {
    await Promise.all((await caches.keys()).map((key) => caches.delete(key)))
  }
}

/** Marca para avisar, ya recargada, que la app se actualizó. */
const UPDATED_KEY = 'shelflife_updated'

export function markUpdated() {
  try {
    sessionStorage.setItem(UPDATED_KEY, '1')
  } catch {
    /* el aviso es opcional */
  }
}

/** ¿Se recargó recién por una actualización? Lo lee una sola vez. */
export function consumeUpdated(): boolean {
  try {
    const was = sessionStorage.getItem(UPDATED_KEY) === '1'
    if (was) sessionStorage.removeItem(UPDATED_KEY)
    return was
  } catch {
    return false
  }
}
