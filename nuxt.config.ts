export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      title: '',
      apiOrigin: '',
      features: {
        publicRegister: false,
      },
    },
    redis: {
      host: '',
      port: 6379,
      password: undefined,
    },
    session: {
      cookieName: 'NUXT_SESSION_ID',
      maxAge: '7d',
      domain: '',
    },
  },
})
