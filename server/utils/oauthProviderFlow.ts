import type { PublicUser, ResultDto } from '@zvonimirsun/iszy-common'
import type { H3Event } from 'h3'

function readPopupChannel(value: unknown) {
  return typeof value === 'string' && /^iszy-oauth-[\w-]{1,64}$/.test(value) ? value : undefined
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
  })[char]!)
}

function renderCallbackPage(title: string, body: string, payload: { success: boolean, message?: string }, popupChannel?: string) {
  return `
    <head>
      <title>${escapeHtml(title)}</title>
      <meta charset="UTF-8">
    </head>
    <body>
      ${escapeHtml(body)}
      <script>
        const popupChannel = ${JSON.stringify(popupChannel || '')};
        if (popupChannel) {
          const channel = new BroadcastChannel(popupChannel);
          channel.postMessage(${JSON.stringify(payload).replace(/</g, '\\u003c')});
          channel.close();
          window.close();
        }
      </script>
    </body>
  `
}

export async function redirectToOAuthProvider(event: H3Event, provider: string) {
  const { apiOrigin } = usePublicConfig()
  const url = getRequestURL(event)
  const state = randomState()

  const popupChannel = readPopupChannel(getQuery(event).popupChannel)
  await setState(state, { popupChannel })

  return sendRedirect(event, `${apiOrigin}/oauth/${provider}?state=${state}&client=${encodeURIComponent(url.origin)}`)
}

export async function redirectToOAuthProviderBind(event: H3Event, provider: string) {
  const { apiOrigin } = usePublicConfig()
  const url = getRequestURL(event)

  const res = await authFetch(event)<ResultDto<string>>('/oauth/code', {
    method: 'POST',
  })
  const code = res.data!
  const state = randomState()

  const popupChannel = readPopupChannel(getQuery(event).popupChannel)
  await setState(state, {
    isBind: true,
    popupChannel,
  })

  return sendRedirect(event, `${apiOrigin}/oauth/${provider}/bind?state=${state}&client=${encodeURIComponent(url.origin)}&access_token=${code}`)
}

export async function handleOAuthProviderCallback(event: H3Event, provider: string) {
  const { title } = usePublicConfig()
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
      return renderCallbackPage(`${title} - 绑定失败`, error, {
        success: false,
        message: error,
      }, stateData.popupChannel)
    }

    return renderCallbackPage(`${title} - 绑定成功`, '验证成功', {
      success: true,
    }, stateData.popupChannel)
  }

  const pendingToken = typeof query.pending_token === 'string' ? query.pending_token : undefined
  if (provider === 'sso' && pendingToken) {
    const completionId = await createSsoCompletion(event, pendingToken)
    const channelQuery = stateData.popupChannel ? `&popupChannel=${encodeURIComponent(stateData.popupChannel)}` : ''
    return sendRedirect(event, `/sso/complete?flow=${completionId}${channelQuery}`)
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
    return renderCallbackPage(`${title} - 登录失败`, errorMessage, {
      success: false,
      message: errorMessage,
    }, stateData.popupChannel)
  }

  return renderCallbackPage(`${title} - 登录成功`, '登录成功', {
    success: true,
  }, stateData.popupChannel)
}
