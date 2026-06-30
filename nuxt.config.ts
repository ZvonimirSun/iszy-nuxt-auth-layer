import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  $meta: {
    name: 'iszy-nuxt-auth-layer',
  },
  modules: [
    '@pinia/nuxt',
    '@nuxt/ui',
  ],
  alias: {
    '##shared': fileURLToPath(new URL('./shared', import.meta.url)),
    '##stores': fileURLToPath(new URL('./app/stores', import.meta.url)),
  },
  icon: {
    customCollections: [
      {
        prefix: 'iszy-auth',
        dir: fileURLToPath(new URL('./app/assets/icons', import.meta.url)),
      },
    ],
  },
  compatibilityDate: '2026-06-30',
  runtimeConfig: {
    public: {
      title: '',
      apiOrigin: '',
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
