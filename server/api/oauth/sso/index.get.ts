export default defineEventHandler(async (event) => {
  return redirectToOAuthProvider(event, 'sso')
})
