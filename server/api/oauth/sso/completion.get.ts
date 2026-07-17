import type { ResultDto } from '@zvonimirsun/iszy-common'
import type { SsoCompletionProfile } from '##shared/types/auth'

export default defineEventHandler(async (event): Promise<ResultDto<SsoCompletionProfile>> => {
  const query = getQuery(event)
  const flowId = typeof query.flow === 'string' ? query.flow : undefined
  const completion = await requireSsoCompletion(event, flowId)

  try {
    return await authFetch(event)<ResultDto<SsoCompletionProfile>>('/oauth/sso/completion', {
      method: 'POST',
      body: {
        pendingToken: completion.pendingToken,
      },
    })
  }
  catch (error) {
    const completionError = getSsoCompletionError(error, '获取 SSO 账户信息失败')
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
})
