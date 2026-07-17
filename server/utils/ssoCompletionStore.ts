import type { H3Event } from 'h3'
import type { SsoCompletionState } from '##shared/types/auth'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import ms from 'ms'

const SSO_COMPLETION_COOKIE_PATH = '/'
const SSO_COMPLETION_TTL = ms('10m') / 1000
const SSO_COMPLETION_ID_PATTERN = /^[0-9a-f]{64}$/

function createCompletionId() {
  return randomBytes(32).toString('hex')
}

function getCompletionCookieName(id: string) {
  const { session } = useRuntimeConfig()
  return `${session.cookieName}_SSO_COMPLETION_${id}`
}

function getCompletionKey(id: string) {
  return `oauth:sso:completion-flow:${id}`
}

function clearCompletionCookie(event: H3Event, id: string) {
  deleteCookie(event, getCompletionCookieName(id), {
    path: SSO_COMPLETION_COOKIE_PATH,
  })
}

export async function createSsoCompletion(event: H3Event, pendingToken: string) {
  const id = createCompletionId()
  const browserSecret = createCompletionId()
  const storage = useStorage<SsoCompletionState>('redis')

  await storage.setItem(getCompletionKey(id), { pendingToken, browserSecret }, {
    ttl: SSO_COMPLETION_TTL,
  })
  setCookie(event, getCompletionCookieName(id), browserSecret, {
    httpOnly: true,
    maxAge: SSO_COMPLETION_TTL,
    path: SSO_COMPLETION_COOKIE_PATH,
    sameSite: 'lax',
    secure: true,
  })
  return id
}

export async function requireSsoCompletion(event: H3Event, id?: string) {
  if (id && SSO_COMPLETION_ID_PATTERN.test(id)) {
    const browserSecret = getCookie(event, getCompletionCookieName(id))
    const storage = useStorage<SsoCompletionState>('redis')
    const completion = await storage.getItem(getCompletionKey(id))
    if (completion && browserSecret && secretsMatch(browserSecret, completion.browserSecret)) {
      return completion
    }
    clearCompletionCookie(event, id)
  }

  throw createError({
    statusCode: 410,
    message: 'SSO 登录流程无效或已过期',
  })
}

export async function removeSsoCompletion(event: H3Event, id?: string) {
  if (id && SSO_COMPLETION_ID_PATTERN.test(id)) {
    const storage = useStorage<SsoCompletionState>('redis')
    await storage.removeItem(getCompletionKey(id))
    clearCompletionCookie(event, id)
  }
}

function secretsMatch(left: string, right: string) {
  if (!SSO_COMPLETION_ID_PATTERN.test(left) || !SSO_COMPLETION_ID_PATTERN.test(right)) {
    return false
  }
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
}
