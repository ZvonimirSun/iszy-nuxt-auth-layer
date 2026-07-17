export default defineEventHandler(async (event) => {
  return handleOAuthProviderCallback(event, 'sso')
})
