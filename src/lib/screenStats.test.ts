import { describe, expect, it } from 'vitest'
import { screenStats } from './screenStats'
import { makeItem } from '../test/factories'

const labels = (parts: { value: string; label: string }[]) => parts.map((p) => `${p.value} ${p.label}`)

describe('screenStats', () => {
  it('con la biblioteca vacía solo dice los títulos', () => {
    expect(labels(screenStats([]))).toEqual(['0 títulos'])
  })

  it('no muestra lo que está en cero', () => {
    const items = [makeItem({ media_type: 'movie', status: 'wishlist' })]
    expect(labels(screenStats(items))).toEqual(['1 título'])
  })

  it('cuenta películas vistas, episodios (sin contar películas), viendo y el tiempo', () => {
    const items = [
      makeItem({ media_type: 'movie', status: 'completed', progress: 1, time_spent_minutes: 120 }),
      makeItem({ media_type: 'series', status: 'in_progress', progress: 10, time_spent_minutes: 400 }),
      makeItem({ media_type: 'anime', status: 'completed', progress: 160, time_spent_minutes: 3800 }),
    ]
    expect(labels(screenStats(items))).toEqual([
      '3 títulos',
      '1 viendo',
      '1 película vista',
      '170 episodios',
      '72h frente a la pantalla',
    ])
  })

  it('usa singular y plural', () => {
    const items = [
      makeItem({ media_type: 'movie', status: 'completed' }),
      makeItem({ media_type: 'movie', status: 'completed' }),
      makeItem({ media_type: 'series', status: 'in_progress', progress: 1 }),
    ]
    expect(labels(screenStats(items)).slice(0, 4)).toEqual(['3 títulos', '1 viendo', '2 películas vistas', '1 episodio'])
  })
})
