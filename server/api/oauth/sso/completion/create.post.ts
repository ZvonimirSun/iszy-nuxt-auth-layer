import type { ResultDto } from '@zvonimirsun/iszy-common'
import type {
  AuthTokenData,
  PublicSimpleUser,
  SsoCompletionCreateBody,
} from '##shared/types/auth'

export default defineEventHandler(async (event): Promise<ResultDto<PublicSimpleUser>> => {
  const query = getQuery(event)
  const flowId = typeof query.flow === 'string' ? query.flow : undefined
  const completion = await requireSsoCompletion(event, flowId)
  const body = await readBody<SsoCompletionCreateBody>(event)
  const userName = body?.userName?.trim()
  const nickName = body?.nickName?.trim()
  const email = body?.email?.trim() || undefined

  if (!userName || !nickName || !body?.passwd) {
    throw createError({
      statusCode: 400,
      message: '用户名、昵称和密码不能为空',
    })
  }

  let res: ResultDto<AuthTokenData>
  try {
    res = await authFetch(event)<ResultDto<AuthTokenData>>('/oauth/sso/completion/create', {
      method: 'POST',
      body: {
        pendingToken: completion.pendingToken,
        userName,
        nickName,
        email,
        passwd: body.passwd,
      },
    })
  }
  catch (error) {
    const completionError = getSsoCompletionError(error, '创建账户失败')
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
      message: res.message || '创建账户失败',
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
    message: res.message || '账户创建成功',
    data: toPublicSimpleUser(res.data.profile),
  }
})
