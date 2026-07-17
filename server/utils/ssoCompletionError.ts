import type { FetchError } from 'ofetch'

interface ErrorData {
  message?: string
}

export function getSsoCompletionError(error: unknown, fallback: string) {
  const fetchError = error as FetchError<ErrorData>
  return {
    message: fetchError.data?.message || (error instanceof Error ? error.message : fallback),
    status: fetchError.response?.status,
  }
}
