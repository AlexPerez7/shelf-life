import { describe, expect, it } from 'vitest'
import { coverPath, fitCover } from './coverUpload'

describe('fitCover', () => {
  it('achica una foto de cámara manteniendo la proporción', () => {
    expect(fitCover(3000, 4000)).toEqual({ width: 600, height: 800 })
  })

  it('respeta también el alto máximo (fotos muy altas)', () => {
    expect(fitCover(1000, 3000)).toEqual({ width: 300, height: 900 })
  })

  it('no agranda una imagen chica', () => {
    expect(fitCover(300, 450)).toEqual({ width: 300, height: 450 })
  })
})

describe('coverPath', () => {
  it('va en la carpeta del usuario, como exige la política de Storage', () => {
    expect(coverPath('user-1', 'item-9', 123)).toBe('user-1/item-9-123.jpg')
  })
})
