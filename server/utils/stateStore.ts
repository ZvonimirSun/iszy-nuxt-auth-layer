import type { OAuthStateData } from '#shared/types/auth'
import ms from 'ms'

export function getStateKey(state: string): string {
  return `oauth:state:${state}`
}

export async function setState(state: string, data: OAuthStateData) {
  const storage = useStorage<OAuthStateData>('redis')
  return storage.setItem(getStateKey(state), data, {
    ttl: ms('5m') / 1000,
  })
}

export async function getState(state: string) {
  const storage = useStorage<OAuthStateData>('redis')
  return storage.getItem(getStateKey(state))
}

export async function removeState(state: string) {
  const storage = useStorage<OAuthStateData>('redis')
  await storage.removeItem(getStateKey(state))
}
