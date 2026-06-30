export default defineNuxtConfig({
  extends: ['..'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      title: 'ISZY Auth Layer Playground',
      apiOrigin: '',
    },
    playground: {
      authMode: 'sso',
      publicRegister: true,
      ssoTitle: 'ISZY SSO',
    },
  },
})
