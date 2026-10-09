import { supabase } from './supabaseClient'
import { callFn } from './functions'
import type { IgdbSearchResult, NewGame } from '../types/game'
import { appUrl } from './appUrl'
import { gamesPaths } from '../trackers/juegos/paths'

export interface SteamGame {
  appid: number
  name: string
  hours_played: number
  cover_url: string
}

export interface SteamProfile {
  steam_id: string
  steam_persona: string | null
  steam_avatar: string | null
  /** Solo lo sabemos al vincular; undefined si se cargó desde la DB. */
  is_public?: boolean
}

/** Perfil de Steam vinculado del usuario actual, o null si no vinculó ninguno. */
export async function getSteamProfile(): Promise<SteamProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('steam_id, steam_persona, steam_avatar')
    .eq('user_id', user.id)
    .maybeSingle()

  return data?.steam_id ? (data as SteamProfile) : null
}

/** Devuelve la URL de Steam a la que hay que redirigir el navegador. */
export async function startSteamLogin(): Promise<string> {
  const returnTo = appUrl(gamesPaths.steamCallback)
  const { url } = await callFn<{ url: string }>('steam-auth', {
    action: 'start',
    returnTo,
  })
  return url
}

/** Valida la vuelta de Steam (query string con los openid.*) y guarda el perfil. */
export async function verifySteamLogin(search: string): Promise<SteamProfile> {
  const params = Object.fromEntries(new URLSearchParams(search))
  const res = await callFn<{
    steamId: string
    persona: string | null
    avatar: string | null
    isPublic: boolean
  }>('steam-auth', { action: 'verify', params })

  return {
    steam_id: res.steamId,
    steam_persona: res.persona,
    steam_avatar: res.avatar,
    is_public: res.isPublic,
  }
}

export async function disconnectSteam(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase
    .from('profiles')
    .update({ steam_id: null, steam_persona: null, steam_avatar: null })
    .eq('user_id', user.id)
  if (error) throw error
}

export async function getSteamLibrary(): Promise<SteamGame[]> {
  return (await callFn<SteamGame[]>('steam-library')) ?? []
}

/**
 * Convierte un juego de Steam en un alta. Si IGDB lo conoce, se completa con
 * su metadata (portada vertical, géneros, sinopsis, año e igdb_id, que además
 * habilita la duración estimada exacta). El nombre se mantiene el de Steam.
 */
export function steamGameToNewGame(game: SteamGame, igdb?: IgdbSearchResult): NewGame {
  return {
    title: game.name,
    platform: 'PC',
    status: game.hours_played > 0 ? 'jugando' : 'pendiente',
    hours_played: game.hours_played,
    cover_url: igdb?.cover_url ?? game.cover_url,
    steam_appid: game.appid,
    ...(igdb && {
      igdb_id: igdb.id,
      genre: igdb.genres.join(', '),
      summary: igdb.summary ?? '',
      first_release_date: igdb.first_release_date ?? undefined,
    }),
  }
}
