export default defineEventHandler(async (event) => {
  return proxyFetch(event)
})
