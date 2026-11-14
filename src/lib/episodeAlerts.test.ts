import { describe, expect, it } from 'vitest'
import { airKey, alertPayload, episodeText, isDue, type Upcoming } from '../../supabase/functions/_shared/alerts'

const tmdb = (air_date: string, season: number | null = 2, episode: number | null = 5): Upcoming => ({
  external_id: '1',
  air_date,
  season,
  episode,
  name: null,
})

describe('¿ya toca avisar?', () => {
  it('un episodio con día (TMDB): el día de estreno, desde la mañana', () => {
    const ep = tmdb('2026-11-14')
    expect(isDue(ep, new Date('2026-11-14T11:59:00Z'))).toBe(false) // todavía de madrugada
    expect(isDue(ep, new Date('2026-11-14T12:00:00Z'))).toBe(true)
    expect(isDue(ep, new Date('2026-11-14T23:30:00Z'))).toBe(true)
    expect(isDue(ep, new Date('2026-11-13T18:00:00Z'))).toBe(false) // un día antes
    expect(isDue(ep, new Date('2026-11-15T13:00:00Z'))).toBe(false) // un día después
  })

  it('un episodio con hora (AniList): cuando falta una hora o menos', () => {
    const ep = tmdb('2026-11-14T20:00:00.000Z', null, 7)
    expect(isDue(ep, new Date('2026-11-14T18:59:00Z'))).toBe(false)
    expect(isDue(ep, new Date('2026-11-14T19:00:00Z'))).toBe(true)
    expect(isDue(ep, new Date('2026-11-14T20:30:00Z'))).toBe(true)
  })

  it('una fecha inválida no avisa', () => {
    expect(isDue(tmdb('mañana por la noche'), new Date('2026-11-14T20:00:00Z'))).toBe(false)
  })
})

describe('texto del aviso', () => {
  it('nombra el episodio según lo que se sabe', () => {
    expect(episodeText(tmdb('2026-11-14', 2, 5))).toBe('T2 · E5')
    expect(episodeText(tmdb('2026-11-14', null, 7))).toBe('Ep. 7')
    expect(episodeText(tmdb('2026-11-14', null, null))).toBe('Nuevo episodio')
  })

  it('arma el aviso con la ruta del título y una clave por episodio', () => {
    expect(alertPayload('Severance', tmdb('2026-11-14'), 'abc')).toEqual({
      title: 'Severance',
      body: 'T2 · E5 sale hoy',
      url: 'pantalla/abc',
      tag: 'abc:2x5',
    })
    expect(airKey(tmdb('2026-11-14', null, 7))).toBe('0x7')
  })
})
