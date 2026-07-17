import type { ResultDto } from '@zvonimirsun/iszy-common'
import type {
  AuthTokenData,
  PublicSimpleUser,
  SsoCompletionBindBody,
} from '##shared/types/auth'

export default defineEventHandler(async (event): Promise<ResultDto<PublicSimpleUser>> => {
  const query = getQuery(event)
  const flowId = typeof query.flow === 'string' ? query.flow : undefined
  const completion = await requireSsoCompletion(event, flowId)
  const body = await readBody<SsoCompletionBindBody>(event)
  const username = body?.username?.trim()

  if (!username || !body?.password) {
    throw createError({
      statusCode: 400,
      message: '用户名或邮箱和密码不能为空',
    })
  }

  let res: ResultDto<AuthTokenData>
  try {
    res = await authFetch(event)<ResultDto<AuthTokenData>>('/oauth/sso/completion/bind', {
      method: 'POST',
      body: {
        pendingToken: completion.pendingToken,
        username,
        password: body.password,
        useSsoNickname: body.useSsoNickname,
      },
    })
  }
  catch (error) {
    const completionError = getSsoCompletionError(error, '登录并绑定失败')
    if (completionError.status === 410) {
      await removeSsoCompletion(event, flowId)
      throw createError({
        statusCode: 410,
        message: completionError.message,
      })
    }
    return {
      success: false,
      message: completionError.message,
    }
  }

  if (!res.success || !res.data) {
    return {
      success: false,
      message: res.message || '登录并绑定失败',
    }
  }

  try {
    await setRedisSession(event, {
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
    })
  }
  finally {
    await removeSsoCompletion(event, flowId)
  }

  return {
    success: true,
    message: res.message || '登录并绑定成功',
    data: toPublicSimpleUser(res.data.profile),
  }
})
