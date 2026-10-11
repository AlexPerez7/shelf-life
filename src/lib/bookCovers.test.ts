import { describe, expect, it } from 'vitest'
import { checkedCover, coverCandidates, eachLimited, isUncheckedCover } from './bookCovers'
import { makeItem } from '../test/factories'

const imported = 'https://covers.openlibrary.org/b/isbn/9780439023481-L.jpg?default=false'

describe('portadas a revisar', () => {
  it('reconoce la portada puesta al importar y la deja limpia al comprobarla', () => {
    expect(isUncheckedCover(imported)).toBe(true)
    expect(isUncheckedCover('https://covers.openlibrary.org/b/id/123-L.jpg')).toBe(false)
    expect(isUncheckedCover(null)).toBe(false)
    expect(checkedCover(imported)).toBe('https://covers.openlibrary.org/b/isbn/9780439023481-L.jpg')
  })

  it('separa los libros sin portada de los que hay que comprobar', () => {
    const sin = makeItem({ cover_url: null })
    const importado = makeItem({ cover_url: imported })
    const ok = makeItem({ cover_url: 'https://covers.openlibrary.org/b/id/1-L.jpg' })
    const { missing, unchecked } = coverCandidates([sin, importado, ok])
    expect(missing).toEqual([sin])
    expect(unchecked).toEqual([importado])
  })
})

describe('eachLimited', () => {
  it('procesa todo sin pasar el límite de tareas a la vez', async () => {
    let running = 0
    let max = 0
    const done: number[] = []
    await eachLimited([1, 2, 3, 4, 5], 2, async (n) => {
      running++
      max = Math.max(max, running)
      await new Promise((r) => setTimeout(r, 1))
      done.push(n)
      running--
    })
    expect(done.sort()).toEqual([1, 2, 3, 4, 5])
    expect(max).toBe(2)
  })
})
