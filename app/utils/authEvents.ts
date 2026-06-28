import type { PublicSimpleUser } from '##shared/types/auth'
import mitt from 'mitt'

export interface AuthEventPayload {
  profile?: PublicSimpleUser
  fetcher?: typeof $fetch
}

export type AuthEvents = Record<string | symbol, unknown> & {
  loginSuccess: AuthEventPayload
  profileUpdated: AuthEventPayload
  profileRemoved: AuthEventPayload
  logoutSuccess: undefined
}

export const authEvents = mitt<AuthEvents>()
