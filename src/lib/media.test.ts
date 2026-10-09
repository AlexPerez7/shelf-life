import { describe, expect, it } from 'vitest'
import {
  episodeLabel,
  episodeProgress,
  itemSeasons,
  progressChanges,
  resultToItem,
  resultToItemWithStatus,
  seasonEpisode,
  statusChanges,
} from './media'
import { makeItem } from '../test/factories'
import type { MediaSearchResult } from '../types/item'

const TODAY = '2026-10-09'

describe('temporadas', () => {
  const seasons = [10, 8, 12]

  it('traduce el episodio de corrido a temporada y episodio', () => {
    expect(seasonEpisode(1, seasons)).toEqual({ season: 1, episode: 1 })
    expect(seasonEpisode(10, seasons)).toEqual({ season: 1, episode: 10 })
    expect(seasonEpisode(11, seasons)).toEqual({ season: 2, episode: 1 })
    expect(seasonEpisode(30, seasons)).toEqual({ season: 3, episode: 12 })
  })

  it('no inventa: fuera de rango o sin temporadas es null', () => {
    expect(seasonEpisode(0, seasons)).toBeNull()
    expect(seasonEpisode(31, seasons)).toBeNull()
    expect(seasonEpisode(5, undefined)).toBeNull()
  })

  it('etiqueta "T2 · E5" o, sin temporadas, "Ep. 15"', () => {
    expect(episodeLabel(15, seasons)).toBe('T2 · E5')
    expect(episodeLabel(15, undefined)).toBe('Ep. 15')
  })

  it('solo usa las temporadas si suman el total del ítem', () => {
    expect(itemSeasons(makeItem({ progress_total: 30, metadata: { seasons } }))).toEqual(seasons)
    expect(itemSeasons(makeItem({ progress_total: 31, metadata: { seasons } }))).toBeUndefined()
  })

  it('avance legible', () => {
    expect(episodeProgress(makeItem({ media_type: 'series', progress: 15, progress_total: 30, metadata: { seasons } }))).toBe(
      'T2 · E5 · 15 de 30'
    )
    expect(episodeProgress(makeItem({ media_type: 'anime', progress: 5, progress_total: 12 }))).toBe('Episodio 5 de 12')
    expect(episodeProgress(makeItem({ media_type: 'anime', progress: 0, progress_total: 12 }))).toBe('12 episodios')
    expect(episodeProgress(makeItem({ media_type: 'anime', progress: 0 }))).toBe('Sin empezar')
  })
})

describe('reglas de estado y avance', () => {
  it('empezar guarda la fecha de inicio solo la primera vez', () => {
    expect(statusChanges(makeItem(), 'in_progress', TODAY)).toEqual({ status: 'in_progress', date_started: TODAY })
    expect(statusChanges(makeItem({ date_started: '2026-01-01' }), 'in_progress', TODAY)).toEqual({
      status: 'in_progress',
    })
  })

  it('terminar completa el avance y pone la fecha de fin', () => {
    expect(statusChanges(makeItem({ progress: 3, progress_total: 10 }), 'completed', TODAY)).toEqual({
      status: 'completed',
      date_finished: TODAY,
      progress: 10,
    })
  })

  it('el primer avance pasa a "en curso" y llegar al total, a terminado', () => {
    expect(progressChanges(makeItem({ status: 'planned', progress_total: 10 }), 1, TODAY)).toMatchObject({
      status: 'in_progress',
      progress: 1,
      date_started: TODAY,
    })
    expect(progressChanges(makeItem({ status: 'in_progress', progress: 9, progress_total: 10 }), 10, TODAY)).toMatchObject({
      status: 'completed',
      progress: 10,
      date_finished: TODAY,
    })
    expect(progressChanges(makeItem({ status: 'in_progress', progress: 4 }), 5, TODAY)).toEqual({ progress: 5 })
  })
})

describe('alta desde un resultado de búsqueda', () => {
  const series: MediaSearchResult = {
    source: 'tmdb',
    external_id: '1399',
    media_type: 'series',
    title: 'Juego de tronos',
    original_title: 'Game of Thrones',
    cover_url: 'https://image.tmdb.org/t/p/w500/x.jpg',
    release_date: '2011-04-17',
    genres: ['Drama'],
    summary: null,
    episodes: 73,
    runtime_minutes: 57,
    seasons: [10, 10, 10, 10, 10, 10, 7, 6],
  }

  it('con temporadas, el total es su suma (no number_of_episodes)', () => {
    const item = resultToItem({ ...series, episodes: 74 })
    expect(item.progress_total).toBe(73)
    expect(item.metadata).toMatchObject({ seasons: series.seasons, original_title: 'Game of Thrones', runtime_minutes: 57 })
  })

  it('con estado elegido: "ya la vi" completa el avance y pone la fecha', () => {
    expect(resultToItemWithStatus(series, 'completed', TODAY)).toMatchObject({
      status: 'completed',
      progress: 73,
      date_finished: TODAY,
    })
    expect(resultToItemWithStatus(series, 'in_progress', TODAY)).toMatchObject({
      status: 'in_progress',
      date_started: TODAY,
    })
  })
})
