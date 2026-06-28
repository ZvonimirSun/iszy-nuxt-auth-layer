import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  $meta: {
    name: 'iszy-nuxt-auth-layer',
  },
  alias: {
    '##shared': fileURLToPath(new URL('./shared', import.meta.url)),
  },
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
