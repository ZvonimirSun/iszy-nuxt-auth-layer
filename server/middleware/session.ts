export default defineResponseMiddleware(async (event) => {
  await setRedisSession(event, await getRedisSession(event))
})
