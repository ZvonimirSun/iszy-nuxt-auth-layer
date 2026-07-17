import type { ResultDto } from '@zvonimirsun/iszy-common'

interface SsoCompletionStartBody {
  pendingToken?: string
  pending_token?: string
}

interface SsoCompletionStartResult {
  flow: string
}

export default defineEventHandler(async (event): Promise<ResultDto<SsoCompletionStartResult>> => {
  const body = await readBody<SsoCompletionStartBody>(event)
  const pendingToken = body?.pendingToken || body?.pending_token

  if (!pendingToken) {
    throw createError({
      statusCode: 400,
      message: '缺少 SSO 待绑定凭证',
    })
  }

  const flow = await createSsoCompletion(event, pendingToken)
  return {
    success: true,
    message: 'SSO 登录流程已创建',
    data: {
      flow,
    },
  }
})
