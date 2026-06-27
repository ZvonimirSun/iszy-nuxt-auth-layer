export default defineEventHandler(async (event) => {
  const { apiOrigin } = usePublicConfig()
  const { provider } = event.context.params as { provider: string }
  const url = getRequestURL(event)
  const state = random()

  await setState(state, {})

  return sendRedirect(event, `${apiOrigin}/oauth/${provider}?state=${state}&client=${encodeURIComponent(url.origin)}`)
})
