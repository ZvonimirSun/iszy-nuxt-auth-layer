import type { PublicUser, ResultDto } from '@zvonimirsun/iszy-common'
import type { PublicSimpleUser } from '##shared/types/auth'

export default defineEventHandler(async (event): Promise<ResultDto<{
  logged: boolean
  profile?: PublicSimpleUser
}>> => {
  const session = await getRedisSession(event)
  if (!session) {
    return {
      success: true,
      data: {
        logged: false,
      },
      message: '未登录',
    }
  }

  try {
    const res = await authFetch(event)<ResultDto<PublicUser>>('/user/me')
    if (res.success && res.data) {
      return {
        success: true,
        data: {
          logged: true,
          profile: toPublicSimpleUser(res.data),
        },
        message: '已登录',
      }
    }
    throw createError({ statusCode: 503, statusMessage: 'Authentication service unavailable' })
  }
  catch (error) {
    const status = (error as { statusCode?: number, response?: { status?: number } }).response?.status
      || (error as { statusCode?: number }).statusCode
    if (status !== 401) {
      throw createError({ statusCode: 503, statusMessage: 'Authentication service unavailable' })
    }
  }

  return {
    success: true,
    data: {
      logged: false,
    },
    message: '未登录',
  }
})
