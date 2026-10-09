// Rutas del tracker de juegos (todas bajo /juegos).

export const gamesPaths = {
  library: '/juegos',
  discover: '/juegos/descubrir',
  add: '/juegos/agregar',
  game: (id: string) => `/juegos/juego/${id}`,
  lists: '/juegos/listas',
  list: (id: string) => `/juegos/listas/${id}`,
  stats: '/juegos/estadisticas',
  diary: '/juegos/diario',
  steamImport: '/juegos/steam-import',
  steamCallback: '/juegos/steam-import/callback',
}
