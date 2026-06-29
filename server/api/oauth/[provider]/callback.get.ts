import type { PublicUser, ResultDto } from '@zvonimirsun/iszy-common'

function renderCallbackPage(title: string, origin: string, body: string, payload: { success: boolean, message?: string }) {
  return `
    <head>
      <title>${title}</title>
      <meta charset="UTF-8">
    </head>
    <body>
      ${body}
      <script>
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(${JSON.stringify(payload)}, '${origin}');
        }
      </script>
    </body>
  `
}

export default defineEventHandler(async (event) => {
  const { title } = usePublicConfig()
  const url = getRequestURL(event)
  const query = getQuery(event)
  const state = query.state as string

  if (!state) {
    throw createError({
      statusCode: 400,
      message: '缺少 state 参数',
    })
  }

  const stateData = await getState(state)
  if (!stateData) {
    throw createError({
      statusCode: 400,
      message: '无效的 state 参数',
    })
  }

  await removeState(state)

  if (stateData.isBind) {
    const error = query.error as string | undefined
    if (error) {
      return renderCallbackPage(`${title} - 绑定失败`, url.origin, error, {
        success: false,
        message: error,
      })
    }

    return renderCallbackPage(`${title} - 绑定成功`, url.origin, '验证成功', {
      success: true,
    })
  }

  const code = query.code as string
  const error = query.error as string | undefined
  let errorMessage = error || (!code ? '缺少 code 参数' : '')

  if (!errorMessage) {
    try {
      const res = await authFetch(event)<ResultDto<{
        access_token: string
        refresh_token: string
        profile: PublicUser
      }>>('/oauth/token', {
        method: 'POST',
        query: {
          access_token: code,
        },
      })

      if (!res.success) {
        errorMessage = '获取 token 失败'
      }
      else {
        await setRedisSession(event, {
          access_token: res.data!.access_token,
          refresh_token: res.data!.refresh_token,
        })
      }
    }
    catch {
      errorMessage = '获取 token 失败'
    }
  }

  if (errorMessage) {
    return renderCallbackPage(`${title} - 登录失败`, url.origin, errorMessage, {
      success: false,
      message: errorMessage,
    })
  }

  return renderCallbackPage(`${title} - 登录成功`, url.origin, '登录成功', {
    success: true,
  })
})
