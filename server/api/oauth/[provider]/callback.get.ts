export default defineEventHandler(async (event) => {
  const { provider } = event.context.params as { provider: string }
  return handleOAuthProviderCallback(event, provider)
})
