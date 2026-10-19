import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'

Object.assign(globalThis, { ref, computed, authEvents: { emit() {} } })
const { useUserStore } = await import('../app/stores/user.ts')

beforeEach(() => setActivePinia(createPinia()))

test('profile checks are awaitable, deduplicated and retryable', async () => {
  let resolve
  let requests = 0
  globalThis.$fetch = () => {
    requests++
    return new Promise((yes) => { resolve = yes })
  }
  const user = useUserStore()
  const first = user.pullProfile()
  const second = user.pullProfile()
  assert.equal(requests, 1)
  resolve({ success: true, data: { logged: false } })
  assert.equal((await first).success, true)
  await second
  await user.pullProfile()
  assert.equal(requests, 1)

  globalThis.$fetch = async () => { throw new Error('offline') }
  await assert.rejects(user.pullProfile(true), /offline/)
  globalThis.$fetch = async () => ({ success: true, data: { logged: false } })
  assert.equal((await user.pullProfile(true)).success, true)
})

test('logout invalidates pending checks even when the transport ignores cancellation', async () => {
  let resolve
  globalThis.$fetch = () => new Promise((yes) => { resolve = yes })
  const user = useUserStore()
  const pending = user.pullProfile()
  const rejected = assert.rejects(pending, { name: 'AbortError' })
  await user.removeProfile()
  resolve({ success: true, data: { logged: true, profile: { id: 'stale' } } })
  await rejected
  assert.equal(user.logged, false)
})

test('forced checks cannot be overwritten by older requests', async () => {
  const resolutions = []
  globalThis.$fetch = () => new Promise(resolve => resolutions.push(resolve))
  const user = useUserStore()
  const old = user.pullProfile()
  const rejected = assert.rejects(old, { name: 'AbortError' })
  const current = user.pullProfile(true)
  resolutions[1]({ success: true, data: { logged: true, profile: { id: 'current' } } })
  await current
  resolutions[0]({ success: true, data: { logged: true, profile: { id: 'old' } } })
  await rejected
  assert.equal(user.profile.id, 'current')
})

test('API-only renewal skips pages and payloads while keeping API responses private', async () => {
  const config = { session: { renewalScope: 'api' } }
  let path = '/'
  let reads = 0
  let writes = 0
  const headers = []
  Object.assign(globalThis, {
    defineResponseMiddleware: handler => handler,
    useRuntimeConfig: () => config,
    getRequestURL: () => new URL(`http://localhost${path}`),
    getRedisSession: async () => { reads++ },
    setRedisSession: async () => { writes++ },
    setResponseHeader: (_event, key, value) => headers.push([key, value]),
  })
  const { default: handler } = await import('../server/middleware/session.ts')
  for (path of ['/', '/tool', '/_nuxt/entry.js', '/tool/_payload.json', '/apiary'])
    await handler({})
  assert.equal(reads, 0)
  assert.equal(writes, 0)
  assert.equal(headers.length, 0)
  for (path of ['/api', '/api/auth/check', '/api/oauth/github/callback'])
    await handler({})
  assert.equal(reads, 3)
  assert.equal(writes, 3)
  assert.deepEqual(headers[0], ['Cache-Control', 'private, no-store'])
  config.session.renewalScope = 'all'
  path = '/'
  await handler({})
  assert.equal(reads, 4)
})

test('check distinguishes an expired session from a backend outage', async () => {
  let status = 401
  Object.assign(globalThis, {
    defineEventHandler: handler => handler,
    getRedisSession: async () => ({ id: 'fixture' }),
    authFetch: () => async () => { throw { response: { status } } },
    createError: data => Object.assign(new Error(data.statusMessage), data),
  })
  const { default: check } = await import('../server/api/auth/check.get.ts')
  assert.equal((await check({})).data.logged, false)
  status = 500
  await assert.rejects(check({}), { statusCode: 503 })
})
