import { listPaths } from '../../lib/listPaths'

// Rutas del tracker de juegos (todas bajo /juegos, salvo las listas, que
// son comunes a los tres trackers).

export const gamesPaths = {
  library: '/juegos',
  discover: '/juegos/descubrir',
  add: '/juegos/agregar',
  game: (id: string) => `/juegos/juego/${id}`,
  lists: listPaths.lists,
  list: listPaths.list,
  stats: '/juegos/estadisticas',
  diary: '/juegos/diario',
  steamImport: '/juegos/steam-import',
  steamCallback: '/juegos/steam-import/callback',
}
