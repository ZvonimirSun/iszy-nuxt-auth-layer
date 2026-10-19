export default defineResponseMiddleware(async (event) => {
  const { session } = useRuntimeConfig(event)
  const path = getRequestURL(event).pathname
  if (session.renewalScope === 'api' && path !== '/api' && !path.startsWith('/api/')) {
    return
  }
  if (path === '/api' || path.startsWith('/api/')) {
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
  }
  await setRedisSession(event, await getRedisSession(event))
})
