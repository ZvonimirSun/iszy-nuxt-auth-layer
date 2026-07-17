export default defineEventHandler(async (event) => {
  return redirectToOAuthProviderBind(event, 'sso')
})
