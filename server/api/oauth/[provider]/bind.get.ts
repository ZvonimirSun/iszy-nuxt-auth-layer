import type { ResultDto } from '@zvonimirsun/iszy-common'

export default defineEventHandler(async (event) => {
  const { apiOrigin } = usePublicConfig()
  const { provider } = event.context.params as { provider: string }
  const url = getRequestURL(event)

  const res = await authFetch(event)<ResultDto<string>>('/oauth/code', {
    method: 'POST',
  })
  const code = res.data!
  const state = randomState()

  await setState(state, {
    isBind: true,
  })

  return sendRedirect(event, `${apiOrigin}/oauth/${provider}/bind?state=${state}&client=${encodeURIComponent(url.origin)}&access_token=${code}`)
})
