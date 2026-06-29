import type { PublicUser, ResultDto } from '@zvonimirsun/iszy-common'
import type { FetchError } from 'ofetch'
import type { PublicSimpleUser } from '##shared/types/auth'

interface LoginFailureData {
  code: 'LOGIN_FAILED' | 'LOGIN_BANNED'
  failedCount?: number
  remainingAttempts?: number
  maxAttempts?: number
  windowSeconds?: number
  retryAfterSeconds?: number
  bannedUntil?: string
}

export default defineEventHandler(async (event): Promise<ResultDto<PublicSimpleUser | LoginFailureData>> => {
  const body = await readBody<{
    userName: string
    password: string
  }>(event)

  if (!body.userName || !body.password) {
    throw createError({
      statusCode: 400,
      message: '用户名和密码不能为空',
    })
  }

  try {
    const res = await authFetch(event)<ResultDto<{
      access_token: string
      refresh_token: string
      profile: PublicUser
    }>>('/auth/login', {
      method: 'POST',
      body: {
        username: body.userName.trim(),
        password: body.password,
      },
    })

    if (res.success) {
      await setRedisSession(event, {
        access_token: res.data!.access_token,
        refresh_token: res.data!.refresh_token,
      })
    }

    return {
      ...res,
      data: res.data?.profile ? toPublicSimpleUser(res.data.profile) : undefined,
    }
  }
  catch (error) {
    await destroyRedisSession(event)
    const errorData = (error as FetchError<ResultDto<LoginFailureData>>).data
    return {
      success: false,
      message: errorData?.message || '登录失败',
      data: errorData?.data,
    }
  }
})
