import { describe, expect, it } from 'vitest'
import {
  addListOp,
  overlayItemListIds,
  overlayListItemIds,
  overlayLists,
  type ListOp,
} from './pendingLists'
import type { GameList } from '../types/game'

const list = (id: string, name = id): GameList => ({
  id,
  user_id: 'u',
  name,
  is_public: false,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
})
const create = (id: string, name = id): ListOp => ({ type: 'create', listId: id, list: list(id, name) })
const update = (listId: string, changes: { name?: string; is_public?: boolean }): ListOp => ({ type: 'update', listId, changes })
const del = (listId: string): ListOp => ({ type: 'delete', listId })
const add = (listId: string, itemId: string): ListOp => ({ type: 'add', listId, itemId })
const remove = (listId: string, itemId: string): ListOp => ({ type: 'remove', listId, itemId })

describe('addListOp', () => {
  it('renombrar una lista que no se creó cambia la lista nueva; dos renombres seguidos se juntan', () => {
    expect(addListOp([create('a', 'Vieja')], update('a', { name: 'Nueva' }))).toEqual([create('a', 'Nueva')])
    expect(addListOp([update('a', { name: 'X' })], update('a', { is_public: true }))).toEqual([
      update('a', { name: 'X', is_public: true }),
    ])
  })

  it('no toca lo que ya se está mandando', () => {
    const first = update('a', { name: 'X' })
    expect(addListOp([first], update('a', { name: 'Y' }), first)).toEqual([first, update('a', { name: 'Y' })])
  })

  it('borrar una lista que no llegó a la base cancela todo lo suyo, sin tocar lo de otras', () => {
    const ops = [create('a'), add('a', 'i1'), update('a', { name: 'x' }), add('b', 'i2')]
    expect(addListOp(ops, del('a'))).toEqual([add('b', 'i2')])
  })

  it('borrar una lista que está en la base deja solo el borrado de esa lista', () => {
    const ops = [add('a', 'i1'), update('a', { name: 'x' }), add('b', 'i2')]
    expect(addListOp(ops, del('a'))).toEqual([add('b', 'i2'), del('a')])
  })

  it('agregar y quitar el mismo título se cancelan, y repetir un cambio no lo duplica', () => {
    expect(addListOp([add('a', 'i1')], remove('a', 'i1'))).toEqual([])
    expect(addListOp([remove('a', 'i1')], add('a', 'i1'))).toEqual([])
    expect(addListOp([add('a', 'i1')], add('a', 'i1'))).toEqual([add('a', 'i1')])
    expect(addListOp([add('a', 'i1')], add('a', 'i2'))).toEqual([add('a', 'i1'), add('a', 'i2')])
  })

  it('un agregado que se está mandando no se cancela: el quitar va detrás', () => {
    const first = add('a', 'i1')
    expect(addListOp([first], remove('a', 'i1'), first)).toEqual([first, remove('a', 'i1')])
  })
})

describe('lo pendiente encima de lo que trae la base', () => {
  it('listas: las nuevas arriba, las renombradas con su nombre y las borradas afuera', () => {
    const server = [list('a'), list('b')]
    const ops = [create('c', 'Nueva'), update('a', { name: 'Renombrada' }), del('b')]
    expect(overlayLists(server, ops).map((l) => `${l.id}:${l.name}`)).toEqual(['c:Nueva', 'a:Renombrada'])
    // Si la base ya la tiene (un reintento), no se repite.
    expect(overlayLists([list('c')], [create('c')]).map((l) => l.id)).toEqual(['c'])
  })

  it('títulos de una lista: lo agregado va primero y lo quitado sale', () => {
    const ops = [add('a', 'n1'), remove('a', 'i2'), add('b', 'zzz')]
    expect(overlayListItemIds(['i1', 'i2'], 'a', ops)).toEqual(['n1', 'i1'])
  })

  it('listas de un título: suma y resta según lo pendiente', () => {
    const ops = [add('a', 'i1'), remove('b', 'i1'), add('c', 'otro')]
    expect([...overlayItemListIds(new Set(['b']), 'i1', ops)]).toEqual(['a'])
  })
})
