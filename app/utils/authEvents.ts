import type { PublicSimpleUser } from '##shared/types/auth'
import type { Fetcher } from '##shared/types/fetcher'
import mitt from 'mitt'

export interface AuthEventPayload {
  profile?: PublicSimpleUser
  fetcher?: Fetcher
}

export type AuthEvents = Record<string | symbol, unknown> & {
  loginSuccess: AuthEventPayload
  profileUpdated: AuthEventPayload
  profileRemoved: AuthEventPayload
  logoutSuccess: undefined
}

export const authEvents = mitt<AuthEvents>()
