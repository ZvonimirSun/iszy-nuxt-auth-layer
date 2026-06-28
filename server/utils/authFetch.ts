import type { PublicUser, ResultDto } from '@zvonimirsun/iszy-common'
import type { H3Event } from 'h3'
import type { NitroFetchRequest, TypedInternalResponse } from 'nitropack'
import type { FetchError } from 'ofetch'
import type { SessionData } from '##shared/types/auth'
import { getProxyRequestHeaders } from 'h3'

export async function proxyFetch(event: H3Event) {
  const sessionId = getSessionId(event)
  const { apiOrigin } = usePublicConfig()
  const target = apiOrigin + event.path.slice(4)

  const headers = getForwardRequestHeaders(event)
  headers['accept-encoding'] = 'identity'

  const body = ['GET', 'HEAD'].includes(event.method) ? undefined : await readRawBody(event)

  const doRequest = async () => {
    if (sessionId) {
      const sessionData = await getRedisSession(event)
      if (sessionData) {
        headers.authorization = `Bearer ${sessionData.access_token}`
      }
    }
    return fetch(target, {
      method: event.method,
      headers,
      body,
      duplex: 'half',
      redirect: 'manual',
    } as RequestInit & { duplex: 'half' })
  }

  let res = await doRequest()
  if (sessionId && res.status === 401) {
    try {
      useRedisSession(event, await refreshWithLock(sessionId, async () => refreshToken(event)))
    }
    catch {
      await destroyRedisSession(event)
      return pipeResponse(event, res)
    }
    res = await doRequest()
  }
  return pipeResponse(event, res)
}

export async function authFetch<T = unknown>(event: H3Event, ...params: Parameters<typeof $fetch>): Promise<TypedInternalResponse<NitroFetchRequest, T>> {
  const sessionId = getSessionId(event)
  const { apiOrigin } = usePublicConfig()
  const [url, opts = {}] = params
  const headers: Record<string, string> = {
    ...getForwardRequestHeaders(event),
    ...(opts.headers as Record<string, string> | undefined),
  }

  opts.headers = headers
  opts.baseURL = apiOrigin
  const fetcher = $fetch as unknown as (request: NitroFetchRequest, options?: typeof opts) => Promise<T>

  const doRequest = async () => {
    if (sessionId) {
      const sessionData = await getRedisSession(event)
      if (sessionData) {
        headers.authorization = `Bearer ${sessionData.access_token}`
      }
    }
    return fetcher(url, opts)
  }

  try {
    return await doRequest() as TypedInternalResponse<NitroFetchRequest, T>
  }
  catch (error) {
    if (sessionId && (error as FetchError)?.response?.status === 401) {
      try {
        useRedisSession(event, await refreshWithLock(sessionId, async () => refreshToken(event)))
        return await doRequest() as TypedInternalResponse<NitroFetchRequest, T>
      }
      catch {
        await destroyRedisSession(event)
        throw error
      }
    }
    throw error
  }
}

async function refreshToken(event: H3Event): Promise<SessionData> {
  const sessionData = await getRedisSession(event)
  if (!sessionData) {
    throw new Error('REFRESH_FAILED')
  }

  const { apiOrigin } = usePublicConfig()
  const res = await $fetch<ResultDto<{
    access_token: string
    refresh_token: string
    profile: PublicUser
  }>>(`${apiOrigin}/auth/refresh`, {
    method: 'POST',
    headers: {
      ...getForwardRequestHeaders(event),
      Authorization: `Bearer ${sessionData.refresh_token}`,
    },
  })

  if (!res.success) {
    throw new Error('REFRESH_FAILED')
  }

  return rotateRedisSession(event, {
    access_token: res.data!.access_token,
    refresh_token: res.data!.refresh_token,
  })
}

const locks = new Map<string, Promise<SessionData>>()

async function refreshWithLock(sessionId: string, fn: () => Promise<SessionData>) {
  if (locks.has(sessionId)) {
    return locks.get(sessionId)!
  }

  const promise = (async () => {
    try {
      return await fn()
    }
    finally {
      locks.delete(sessionId)
    }
  })()

  locks.set(sessionId, promise)
  return promise
}

function getForwardRequestHeaders(event: H3Event) {
  const headers = getProxyRequestHeaders(event, { host: false })
  const remoteAddr = getRequestIP(event, { xForwardedFor: true }) || ''
  const xForwardedFor = headers['x-forwarded-for'] || remoteAddr

  delete headers.cookie
  delete headers.authorization
  if (xForwardedFor) {
    headers['x-forwarded-for'] = xForwardedFor
  }

  return headers
}

async function pipeResponse(event: H3Event, res: Response) {
  setResponseStatus(event, res.status)
  for (const [key, value] of res.headers) {
    if (key.toLowerCase() === 'set-cookie') {
      continue
    }
    setHeader(event, key, value)
  }
  if (res.body == null) {
    return send(event, '')
  }
  return sendStream(event, res.body)
}
