export function usePublicConfig() {
  const { public: publicConfig } = useRuntimeConfig()
  return publicConfig
}
