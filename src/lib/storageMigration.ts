// La app se llamaba PlayDex y sus claves de localStorage empezaban con
// `playdex_`. Se renombran una sola vez a `shelflife_` para no perder
// preferencias, caches ni un timer de sesión en curso.

const OLD_PREFIX = 'playdex_'
const NEW_PREFIX = 'shelflife_'
/** Cache del modelo anterior a `items` (filas de `games`): se descarta. */
const OBSOLETE_PREFIX = 'playdex_games_v1:'

export function migrateStorageKeys() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(OLD_PREFIX)) continue
      const newKey = NEW_PREFIX + key.slice(OLD_PREFIX.length)
      const value = localStorage.getItem(key)
      if (!key.startsWith(OBSOLETE_PREFIX) && value != null && localStorage.getItem(newKey) == null) {
        localStorage.setItem(newKey, value)
      }
      localStorage.removeItem(key)
    }
  } catch {
    /* sin acceso a localStorage: no hay nada que migrar */
  }
}
