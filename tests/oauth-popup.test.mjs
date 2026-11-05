import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { runInNewContext } from 'node:vm'

const origin = 'https://tools.example.test'
const channelName = 'iszy-oauth-test-attempt'
const globals = ['usePublicConfig', 'getRequestURL', 'getQuery', 'randomState', 'setState', 'sendRedirect', 'getState', 'removeState', 'setRedisSession', 'authFetch', 'createSsoCompletion']
const previous = new Map()
for (const name of globals)
  previous.set(name, globalThis[name])

const { handleOAuthProviderCallback, redirectToOAuthProvider } = await import('../server/utils/oauthProviderFlow.ts')

afterEach(() => {
  for (const [name, value] of previous) {
    if (value === undefined)
      delete globalThis[name]
    else
      globalThis[name] = value
  }
})

function setup({ popupChannel = channelName, query = {} } = {}) {
  globalThis.usePublicConfig = () => ({ title: 'Tools', apiOrigin: 'https://api.example.test' })
  globalThis.getRequestURL = () => new URL(`${origin}/api/oauth/linuxdo/callback`)
  globalThis.getQuery = () => ({ state: 'state', code: 'code', ...query })
  globalThis.randomState = () => 'state'
  globalThis.setState = async () => {}
  globalThis.sendRedirect = async (_event, url) => url
  globalThis.getState = async () => ({ popupChannel })
  globalThis.removeState = async () => {}
  globalThis.setRedisSession = async () => {}
  globalThis.authFetch = () => async () => ({
    success: true,
    data: { access_token: 'server-only', refresh_token: 'server-only' },
  })
  globalThis.createSsoCompletion = async () => 'completion-id'
}

test('callback posts a same-origin channel message and closes the popup without opener', async () => {
  setup()
  const html = await handleOAuthProviderCallback({}, 'linuxdo')
  assert.match(html, /new BroadcastChannel\(popupChannel\)/)
  assert.match(html, /const popupChannel = "iszy-oauth-test-attempt"/)
  assert.match(html, /channel\.postMessage\(\{"success":true\}\)/)
  assert.match(html, /window\.close\(\)/)
  assert.doesNotMatch(html, /window\.opener/)
  assert.doesNotMatch(html, /server-only/)
  assert.match(html, /&lt;|登录成功/)

  let received
  let channelWasClosed = false
  const channelClose = () => { channelWasClosed = true }
  const windowClose = () => { windowWasClosed = true }
  let windowWasClosed = false
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    BroadcastChannel: class {
      constructor(name) { assert.equal(name, channelName) }
      postMessage(message) { received = message }
      close() { channelClose() }
    },
    window: { opener: null, close: windowClose },
  })
  assert.equal(received.success, true)
  assert.deepEqual(Object.keys(received), ['success'])
  assert.equal(channelWasClosed, true)
  assert.equal(windowWasClosed, true)
})

test('OAuth entry stores only a validated per-attempt channel in state', async () => {
  setup({ query: { popupChannel: channelName } })
  const states = []
  globalThis.setState = async (...args) => states.push(args)
  await redirectToOAuthProvider({}, 'linuxdo')
  assert.deepEqual(states.at(-1), ['state', { popupChannel: channelName }])

  setup({ query: { popupChannel: '</script>' } })
  globalThis.setState = async (...args) => states.push(args)
  await redirectToOAuthProvider({}, 'linuxdo')
  assert.deepEqual(states.at(-1), ['state', { popupChannel: undefined }])
})

test('SSO completion keeps the popup channel through the completion redirect', async () => {
  setup({ popupChannel: channelName, query: { pending_token: 'pending' } })
  const redirect = await handleOAuthProviderCallback({}, 'sso')
  assert.equal(redirect, `/sso/complete?flow=completion-id&popupChannel=${channelName}`)
})

test('provider error text is rendered as text instead of executable HTML', async () => {
  setup({ query: { error: '<script>alert(1)</script>' } })
  const html = await handleOAuthProviderCallback({}, 'linuxdo')
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
})
