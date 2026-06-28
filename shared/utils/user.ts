import type { PublicUser } from '@zvonimirsun/iszy-common'
import type { PublicSimpleUser } from '##shared/types/auth'

export function toPublicSimpleUser(user: PublicUser): PublicSimpleUser {
  const { status, createBy, updateBy, privileges, ...result } = user
  return result
}
