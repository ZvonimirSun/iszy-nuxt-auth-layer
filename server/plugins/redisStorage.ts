import redisDriver from 'unstorage/drivers/redis'

export default defineNitroPlugin(() => {
  const storage = useStorage()
  const redisConfig = useRuntimeConfig().redis

  const driver = redisDriver({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
  })

  storage.mount('redis', driver)
})
