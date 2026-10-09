import { describe, expect, it } from 'vitest'
import {
  existingScreenKeys,
  importedScreenToItem,
  isLetterboxdFile,
  isScreenDuplicate,
  parseLetterboxdExport,
  parseMalExport,
} from './screenImport'
import { makeItem } from '../test/factories'
import type { MediaSearchResult } from '../types/item'

const MAL = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo><user_id>1</user_id><user_export_type>1</user_export_type></myinfo>
  <anime>
    <series_animedb_id>1</series_animedb_id>
    <series_title><![CDATA[Cowboy Bebop]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>26</series_episodes>
    <my_watched_episodes>20</my_watched_episodes>
    <my_start_date>2020-03-00</my_start_date>
    <my_finish_date>2020-04-02</my_finish_date>
    <my_score>9</my_score>
    <my_status>Completed</my_status>
    <my_comments><![CDATA[La mejor banda sonora]]></my_comments>
    <my_times_watched>2</my_times_watched>
  </anime>
  <anime>
    <series_animedb_id>21</series_animedb_id>
    <series_title>One Piece &amp; más</series_title>
    <series_episodes>0</series_episodes>
    <my_watched_episodes>300</my_watched_episodes>
    <my_start_date>0000-00-00</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>0</my_score>
    <my_status>Watching</my_status>
    <my_comments><![CDATA[]]></my_comments>
    <my_times_watched>0</my_times_watched>
  </anime>
  <anime>
    <series_animedb_id>5114</series_animedb_id>
    <series_title><![CDATA[Fullmetal Alchemist: Brotherhood]]></series_title>
    <series_episodes>64</series_episodes>
    <my_watched_episodes>0</my_watched_episodes>
    <my_score>0</my_score>
    <my_status>Plan to Watch</my_status>
    <my_times_watched>0</my_times_watched>
  </anime>
</myanimelist>`

describe('parseMalExport', () => {
  const anime = parseMalExport(MAL)

  it('lee cada anime con su id de MAL', () => {
    expect(anime.map((a) => [a.malId, a.title])).toEqual([
      ['1', 'Cowboy Bebop'],
      ['21', 'One Piece & más'],
      ['5114', 'Fullmetal Alchemist: Brotherhood'],
    ])
  })

  it('traduce estado, episodios, puntaje, fechas y revisionados', () => {
    const [bebop, onePiece, fma] = anime
    expect(bebop).toMatchObject({
      status: 'completed',
      progress: 26, // terminado: todos, aunque el contador diga 20
      total: 26,
      rating: 9,
      dateStarted: '2020-03-01',
      dateFinished: '2020-04-02',
      notes: 'La mejor banda sonora',
      rewatches: 2,
    })
    expect(onePiece).toMatchObject({
      status: 'in_progress',
      progress: 300,
      total: null,
      rating: null,
      dateStarted: null,
      notes: null,
    })
    expect(fma).toMatchObject({ status: 'wishlist', progress: 0, total: 64 })
  })

  it('rechaza la lista de manga y otros archivos', () => {
    expect(() => parseMalExport('<myanimelist><myinfo><user_export_type>2</user_export_type></myinfo></myanimelist>')).toThrow(
      'manga'
    )
    expect(() => parseMalExport('<html></html>')).toThrow('No reconocemos')
  })
})

const LB = new Map([
  [
    'watched.csv',
    `Date,Name,Year,Letterboxd URI
2021-02-01,Alien,1979,https://boxd.it/a
2022-05-10,"Parasite",2019,https://boxd.it/b
2023-01-15,Amélie,2001,https://boxd.it/c
`,
  ],
  [
    'diary.csv',
    `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2021-02-01,Alien,1979,https://boxd.it/d1,4,,,2021-01-31
2024-07-01,Alien,1979,https://boxd.it/d2,4.5,Yes,,2024-06-30
`,
  ],
  [
    'ratings.csv',
    `Date,Name,Year,Letterboxd URI,Rating
2024-07-01,Alien,1979,https://boxd.it/a,5
2022-05-10,Parasite,2019,https://boxd.it/b,4.5
`,
  ],
  [
    'reviews.csv',
    `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date
2022-05-10,Parasite,2019,https://boxd.it/r,4.5,,"Brillante.<br/>Y con <i>humor</i>.",,2022-05-09
`,
  ],
  [
    'watchlist.csv',
    `Date,Name,Year,Letterboxd URI
2020-12-01,Alien,1979,https://boxd.it/a
2024-09-01,Dune: Part Two,2024,https://boxd.it/e
`,
  ],
  ['deleted/watched.csv', `Date,Name,Year,Letterboxd URI\n2020-01-01,Borrada,2000,x\n`],
])

describe('parseLetterboxdExport', () => {
  const films = parseLetterboxdExport(LB)
  const byTitle = (t: string) => films.find((f) => f.title === t)!

  it('junta los archivos en una entrada por película e ignora las borradas', () => {
    expect(films.map((f) => f.title).sort()).toEqual(['Alien', 'Amélie', 'Dune: Part Two', 'Parasite'])
    expect(isLetterboxdFile('deleted/watched.csv')).toBe(false)
    expect(isLetterboxdFile('letterboxd-yo/diary.csv')).toBe(true)
  })

  it('usa la última vez que se vio, el puntaje actual y cuenta las revisiones', () => {
    expect(byTitle('Alien')).toMatchObject({
      status: 'completed',
      year: 1979,
      rating: 10,
      dateFinished: '2024-06-30',
      dateAdded: '2020-12-01',
      rewatches: 1,
    })
  })

  it('trae la reseña sin HTML y deja lo no visto en "Quiero ver"', () => {
    expect(byTitle('Parasite')).toMatchObject({ rating: 9, review: 'Brillante.\nY con humor.', rewatches: 0 })
    expect(byTitle('Amélie')).toMatchObject({ status: 'completed', rating: null, dateFinished: '2023-01-15' })
    expect(byTitle('Dune: Part Two')).toMatchObject({ status: 'wishlist', dateFinished: null, rewatches: 0 })
  })

  it('rechaza un zip sin los CSV de Letterboxd', () => {
    expect(() => parseLetterboxdExport(new Map([['otro.csv', 'a,b']]))).toThrow('Letterboxd')
  })
})

const alienResult: MediaSearchResult = {
  source: 'tmdb',
  external_id: '348',
  media_type: 'movie',
  title: 'Alien, el octavo pasajero',
  original_title: 'Alien',
  cover_url: 'https://image.tmdb.org/t/p/w500/alien.jpg',
  release_date: '1979-05-25',
  genres: ['Terror'],
  summary: 'En el espacio...',
  episodes: null,
  runtime_minutes: 117,
}

describe('duplicados', () => {
  const keys = existingScreenKeys([
    makeItem({ media_type: 'movie', title: 'Alien, el octavo pasajero', source: 'tmdb', external_id: '348', release_date: '1979-05-25' }),
    makeItem({ media_type: 'movie', title: 'Amélie', release_date: '2001-04-25' }),
    makeItem({ media_type: 'anime', title: 'Cowboy Bebop', source: 'anilist', external_id: '1', release_date: '1998-04-03' }),
  ])
  const films = parseLetterboxdExport(LB)
  const film = (t: string) => films.find((f) => f.title === t)!

  it('reconoce por id externo, por título original y por título del archivo', () => {
    expect(isScreenDuplicate(film('Alien'), alienResult, keys)).toBe(true)
    expect(isScreenDuplicate(film('Alien'), { ...alienResult, external_id: '9' }, keys)).toBe(true)
    expect(isScreenDuplicate(film('Amélie'), null, keys)).toBe(true)
    expect(isScreenDuplicate(film('Parasite'), null, keys)).toBe(false)
  })

  it('no confunde una película con un anime del mismo título', () => {
    const [bebop] = parseMalExport(MAL)
    expect(isScreenDuplicate({ ...bebop, media_type: 'movie' }, null, keys)).toBe(false)
  })
})

describe('importedScreenToItem', () => {
  it('película encontrada: datos de TMDB con estado, puntaje, fechas y reseña del archivo', () => {
    const alien = parseLetterboxdExport(LB).find((f) => f.title === 'Alien')!
    expect(importedScreenToItem(alien, alienResult)).toMatchObject({
      media_type: 'movie',
      title: 'Alien, el octavo pasajero',
      source: 'tmdb',
      external_id: '348',
      cover_url: alienResult.cover_url,
      status: 'completed',
      rating: 10,
      progress: 0,
      progress_total: null,
      date_finished: '2024-06-30',
      replays: 1,
      created_at: '2020-12-01T12:00:00',
      metadata: { runtime_minutes: 117, original_title: 'Alien' },
    })
  })

  it('anime: el total de AniList manda; en curso, el avance no se pasa del total', () => {
    const [bebop, onePiece] = parseMalExport(MAL)
    const anilist = { ...alienResult, source: 'anilist' as const, external_id: '1', media_type: 'anime' as const, episodes: 26 }
    expect(importedScreenToItem(bebop, anilist)).toMatchObject({
      status: 'completed',
      progress: 26,
      progress_total: 26,
      date_started: '2020-03-01',
      date_finished: '2020-04-02',
      notes: 'La mejor banda sonora',
      replays: 2,
    })
    expect(importedScreenToItem({ ...onePiece, progress: 1200 }, { ...anilist, episodes: 1100 })).toMatchObject({
      status: 'in_progress',
      progress: 1100,
      progress_total: 1100,
      date_finished: null,
    })
  })

  it('sin coincidencia: título y año del archivo, sin fuente', () => {
    const dune = parseLetterboxdExport(LB).find((f) => f.title === 'Dune: Part Two')!
    const item = importedScreenToItem(dune, null)
    expect(item).toMatchObject({
      media_type: 'movie',
      title: 'Dune: Part Two',
      release_date: '2024-01-01',
      status: 'wishlist',
      created_at: '2024-09-01T12:00:00',
    })
    expect(item.source).toBeUndefined()
  })
})
