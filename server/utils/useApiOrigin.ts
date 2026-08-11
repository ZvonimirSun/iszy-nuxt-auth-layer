export function useApiOrigin() {
  const config = useRuntimeConfig()
  return config.apiOrigin || config.public.apiOrigin
}
