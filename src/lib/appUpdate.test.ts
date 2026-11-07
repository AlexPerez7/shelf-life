import { describe, expect, it, vi } from 'vitest'
import { checkForUpdate, type SwContainer } from './appUpdate'

/** Un service worker de mentira: `update()` decide qué pasa. */
function fakeSw(onUpdate: (sw: EventTarget, reg: { installing: unknown; waiting: unknown }) => void | Promise<void>) {
  const sw = new EventTarget() as SwContainer
  const registration = {
    installing: null as unknown,
    waiting: null as { postMessage(m: unknown): void } | null,
    update: vi.fn(async () => {
      await onUpdate(sw, registration)
    }),
  }
  sw.getRegistration = async () => registration
  return { sw, registration }
}

describe('actualizar la app', () => {
  it('sin service worker no hay nada que actualizar', async () => {
    expect(await checkForUpdate(undefined)).toBe('unsupported')
    const sw = new EventTarget() as SwContainer
    sw.getRegistration = async () => undefined
    expect(await checkForUpdate(sw)).toBe('unsupported')
  })

  it('si no apareció una versión nueva, ya tiene la última', async () => {
    const { sw, registration } = fakeSw(() => {})
    expect(await checkForUpdate(sw, 50)).toBe('current')
    expect(registration.update).toHaveBeenCalledOnce()
  })

  it('si hay una nueva y toma el control, avisa que hay que recargar', async () => {
    const { sw } = fakeSw((target, reg) => {
      reg.installing = {}
      setTimeout(() => target.dispatchEvent(new Event('controllerchange')), 5)
    })
    expect(await checkForUpdate(sw, 1000)).toBe('new')
  })

  it('si toma el control antes de que update() responda, también cuenta', async () => {
    const { sw } = fakeSw((target) => {
      target.dispatchEvent(new Event('controllerchange'))
    })
    expect(await checkForUpdate(sw, 1000)).toBe('new')
  })

  it('si la nueva sigue bajando al vencer la espera, queda pendiente', async () => {
    const { sw } = fakeSw((_, reg) => {
      reg.installing = {}
    })
    expect(await checkForUpdate(sw, 20)).toBe('pending')
  })

  it('si quedó esperando, le pide pasar', async () => {
    const postMessage = vi.fn()
    const { sw } = fakeSw((target, reg) => {
      reg.waiting = { postMessage }
      setTimeout(() => target.dispatchEvent(new Event('controllerchange')), 5)
    })
    expect(await checkForUpdate(sw, 1000)).toBe('new')
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  it('si no se pudo consultar (sin conexión), el error sale y no queda escuchando', async () => {
    const { sw } = fakeSw(() => {
      throw new Error('Failed to update a ServiceWorker')
    })
    await expect(checkForUpdate(sw, 50)).rejects.toThrow('Failed to update')
  })
})
