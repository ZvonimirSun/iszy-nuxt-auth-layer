import type { PublicUser } from '@zvonimirsun/iszy-common'

export type { PublicUser, RawPrivilege, RawRole, RegisterUser, ResultDto, UpdateUser } from '@zvonimirsun/iszy-common'

export type PublicSimpleUser = Omit<PublicUser, 'status' | 'createBy' | 'updateBy' | 'privileges'>

export interface SessionData {
  id: string
  access_token: string
  refresh_token: string
}

export interface SessionTombstone {
  redirectTo: string
}

export interface OAuthStateData {
  isBind?: boolean
}

export interface AuthFeatures {
  authMode: 'local' | 'sso'
  publicRegister: boolean
  sso: {
    title: string
  }
}
