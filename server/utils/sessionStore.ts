import type { H3Event } from 'h3'
import type { StringValue } from 'ms'
import type { SessionData, SessionTombstone } from '##shared/types/auth'
import { randomBytes } from 'node:crypto'
import ms from 'ms'

const SESSION_TOMBSTONE_TTL = 30
const SESSION_ID_LENGTH = 32

function createSessionId() {
  return randomBytes(SESSION_ID_LENGTH).toString('hex').slice(0, SESSION_ID_LENGTH)
}

export function getSessionId(event: H3Event): string | undefined {
  const { session: sessionConfig } = useRuntimeConfig()
  return getCookie(event, sessionConfig.cookieName)
}

export function getSessionKey(sessionId: string): string {
  return `session:${sessionId}`
}

function setSessionId(id: string, data: Omit<SessionData, 'id'> | SessionData): SessionData {
  return {
    ...data,
    id,
  }
}

export async function getRedisSession(event: H3Event): Promise<SessionData | null> {
  const storage = useStorage<SessionData | SessionTombstone>('redis')
  const sessionId = getSessionId(event)
  if (!sessionId) {
    return null
  }

  const data = await storage.getItem(getSessionKey(sessionId))
  if (!data) {
    return null
  }

  if ('redirectTo' in data) {
    const newData = await storage.getItem(getSessionKey(data.redirectTo))
    if (!newData || 'redirectTo' in newData) {
      return null
    }
    useRedisSession(event, newData)
    return newData
  }

  return data
}

export async function setRedisSession(event: H3Event, data?: Omit<SessionData, 'id'> | SessionData | null) {
  const { session: sessionConfig } = useRuntimeConfig()
  const cookieName = sessionConfig.cookieName
  const ttl = ms(sessionConfig.maxAge as StringValue) / 1000
  const storage = useStorage<SessionData>('redis')

  let sessionId = getSessionId(event)
  if (!data) {
    if (sessionId) {
      await storage.removeItem(getSessionKey(sessionId))
      sessionId = undefined
      deleteCookie(event, cookieName)
    }
    return
  }

  const nextSessionId = sessionId || createSessionId()
  const sessionData = setSessionId(nextSessionId, data)
  await storage.setItem(getSessionKey(nextSessionId), sessionData, { ttl })
  setCookie(event, cookieName, nextSessionId, {
    maxAge: ttl,
    domain: sessionConfig.domain || undefined,
    sameSite: 'lax',
    httpOnly: true,
    secure: true,
    priority: 'high',
  })
}

export async function rotateRedisSession(event: H3Event, data: Omit<SessionData, 'id'> | SessionData) {
  const { session: sessionConfig } = useRuntimeConfig()
  const ttl = ms(sessionConfig.maxAge as StringValue) / 1000
  const storage = useStorage<SessionData | SessionTombstone>('redis')

  const oldSessionId = getSessionId(event)
  const sessionId = createSessionId()
  const sessionData = setSessionId(sessionId, data)

  await storage.setItem(getSessionKey(sessionId), sessionData, { ttl })

  if (oldSessionId) {
    await storage.setItem(
      getSessionKey(oldSessionId),
      { redirectTo: sessionId },
      { ttl: SESSION_TOMBSTONE_TTL },
    )
  }

  useRedisSession(event, sessionData)
  return sessionData
}

export function useRedisSession(event: H3Event, session: SessionData) {
  const { session: sessionConfig } = useRuntimeConfig()
  setCookie(event, sessionConfig.cookieName, session.id, {
    maxAge: ms(sessionConfig.maxAge as StringValue) / 1000,
    domain: sessionConfig.domain || undefined,
    sameSite: 'lax',
    httpOnly: true,
    secure: true,
    priority: 'high',
  })
}

export async function destroyRedisSession(event: H3Event): Promise<void> {
  return setRedisSession(event, undefined)
}
