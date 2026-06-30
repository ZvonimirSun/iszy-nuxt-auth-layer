import type { ResultDto } from '@zvonimirsun/iszy-common'
import type { AuthFeatures } from '##shared/types/auth'

export default defineEventHandler(async (event): Promise<ResultDto<AuthFeatures>> => {
  return await authFetch(event)<ResultDto<AuthFeatures>>('/auth/features')
})
