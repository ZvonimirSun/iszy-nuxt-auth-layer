import type { PublicUser, ResultDto } from '@zvonimirsun/iszy-common'
import type { PublicSimpleUser } from '#shared/types/auth'

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
    const res = await authFetch<ResultDto<PublicUser>>(event, '/user/me')
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
  }
  catch {
    // fall through to the unauthenticated response below
  }

  return {
    success: true,
    data: {
      logged: false,
    },
    message: '未登录',
  }
})
