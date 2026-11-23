import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  buildGeoJsUrl,
  clearIpGeoCache,
  DEFAULT_GEOJS_ORIGIN,
  formatGeoLocation,
  getCachedIpGeo,
  lookupIpGeo,
  parseDeviceIp,
} from '../app/utils/ipGeo.ts'

beforeEach(() => {
  clearIpGeoCache()
})

test('parseDeviceIp parses IPv4/IPv6 CIDR, plain IPs, mapped IPv6, local ranges and invalid input', () => {
  assert.deepEqual(parseDeviceIp('8.8.8.0/24'), { ip: '8.8.8.0', localLabel: undefined })
  assert.deepEqual(parseDeviceIp('8.8.8.8'), { ip: '8.8.8.8', localLabel: undefined })
  assert.deepEqual(parseDeviceIp('::ffff:8.8.8.8'), { ip: '8.8.8.8', localLabel: undefined })
  assert.deepEqual(parseDeviceIp('2001:4860:4860:0:0:0:0:0/64'), { ip: '2001:4860:4860::', localLabel: undefined })
  assert.deepEqual(parseDeviceIp('2001:4860:4860::/64'), { ip: '2001:4860:4860::', localLabel: undefined })

  assert.deepEqual(parseDeviceIp('127.0.0.0/24'), { ip: '127.0.0.0', localLabel: '本地' })
  assert.deepEqual(parseDeviceIp('192.168.1.0/24'), { ip: '192.168.1.0', localLabel: '内网' })
  assert.deepEqual(parseDeviceIp('10.0.0.0/24'), { ip: '10.0.0.0', localLabel: '内网' })
  assert.deepEqual(parseDeviceIp('::/64'), { ip: '::', localLabel: '保留地址' })

  assert.equal(parseDeviceIp('未知'), null)
  assert.equal(parseDeviceIp(''), null)
  assert.equal(parseDeviceIp(undefined), null)
})

test('buildGeoJsUrl supports default origin and custom proxy URLs', () => {
  assert.equal(buildGeoJsUrl('8.8.8.0'), `${DEFAULT_GEOJS_ORIGIN}/v1/ip/geo/8.8.8.0.json`)
  assert.equal(buildGeoJsUrl('8.8.8.0', ''), `${DEFAULT_GEOJS_ORIGIN}/v1/ip/geo/8.8.8.0.json`)
  assert.equal(buildGeoJsUrl('8.8.8.0', 'https://geo.example.com/'), 'https://geo.example.com/v1/ip/geo/8.8.8.0.json')
  assert.equal(buildGeoJsUrl('8.8.8.0', 'https://proxy.example.com/geojs/'), 'https://proxy.example.com/geojs/v1/ip/geo/8.8.8.0.json')
  assert.equal(buildGeoJsUrl('8.8.8.0', '/geojs'), '/geojs/v1/ip/geo/8.8.8.0.json')
  assert.equal(buildGeoJsUrl('8.8.8.0', 'https://proxy.example.com/v1/ip/geo'), 'https://proxy.example.com/v1/ip/geo/8.8.8.0.json')
  assert.equal(buildGeoJsUrl('8.8.8.0', 'https://proxy.example.com/v1/ip/geo.json'), 'https://proxy.example.com/v1/ip/geo.json?ip=8.8.8.0')
  assert.equal(buildGeoJsUrl('2001:4860:4860::'), `${DEFAULT_GEOJS_ORIGIN}/v1/ip/geo/2001%3A4860%3A4860%3A%3A.json`)
})

test('formatGeoLocation localizes country code and filters empty or Unknown fields', () => {
  assert.equal(formatGeoLocation({ country_code: 'CN', country: 'China', region: 'Shanghai', city: 'Shanghai' }), '中国 / Shanghai')
  assert.equal(formatGeoLocation({ country_code: 'US', country: 'United States', region: 'California', city: 'Mountain View' }), '美国 / California / Mountain View')
  assert.equal(formatGeoLocation({ country_code: 'US', country: 'United States' }), '美国')
  assert.equal(formatGeoLocation({ country: 'Unknown', region: 'nil', city: '' }), '')
})

test('lookupIpGeo deduplicates concurrent and repeated requests for identical or equivalent IPs', async () => {
  const requestedUrls = []
  let resolveFetch
  const fetcher = (url) => {
    requestedUrls.push(url)
    return new Promise((resolve) => {
      resolveFetch = resolve
    })
  }

  const first = lookupIpGeo('8.8.8.0/24', { fetcher })
  const second = lookupIpGeo('8.8.8.0/24', { fetcher })
  const third = lookupIpGeo('8.8.8.0', { fetcher })

  assert.equal(requestedUrls.length, 1)
  assert.equal(requestedUrls[0], 'https://get.geojs.io/v1/ip/geo/8.8.8.0.json')

  resolveFetch({
    ip: '8.8.8.0',
    country: 'United States',
    country_code: 'US',
    organization_name: 'Google LLC',
  })

  const [r1, r2, r3] = await Promise.all([first, second, third])
  assert.equal(r1?.label, '美国')
  assert.equal(r1?.organization, 'Google LLC')
  assert.deepEqual(r2, r1)
  assert.deepEqual(r3, r1)

  const fourth = await lookupIpGeo('8.8.8.0/24', { fetcher })
  assert.deepEqual(fourth, r1)
  assert.equal(requestedUrls.length, 1)
  assert.deepEqual(getCachedIpGeo('8.8.8.0/24'), r1)
})

test('lookupIpGeo skips network requests for local or invalid IPs', async () => {
  let calls = 0
  const fetcher = async () => {
    calls++
    return {}
  }

  const local = await lookupIpGeo('192.168.1.0/24', { fetcher })
  const loopback = await lookupIpGeo('127.0.0.0/24', { fetcher })
  const unknown = await lookupIpGeo('未知', { fetcher })

  assert.equal(local?.label, '内网')
  assert.equal(local?.isLocal, true)
  assert.equal(loopback?.label, '本地')
  assert.equal(unknown, null)
  assert.equal(calls, 0)
})

test('lookupIpGeo uses custom proxy origin, supports array responses, and retries after errors', async () => {
  const urls = []
  let shouldFail = true
  const fetcher = async (url) => {
    urls.push(url)
    if (shouldFail) {
      throw new Error('network error')
    }
    return [{
      ip: '114.114.114.0',
      country: 'China',
      country_code: 'CN',
      organization_name: 'Zenlayer Inc',
    }]
  }

  await assert.rejects(
    lookupIpGeo('114.114.114.0/24', {
      origin: 'https://proxy.example.com/v1/ip/geo.json',
      fetcher,
    }),
    /network error/,
  )

  shouldFail = false
  const info = await lookupIpGeo('114.114.114.0/24', {
    origin: 'https://proxy.example.com/v1/ip/geo.json',
    fetcher,
  })

  assert.equal(urls.length, 2)
  assert.equal(urls[0], 'https://proxy.example.com/v1/ip/geo.json?ip=114.114.114.0')
  assert.equal(info?.label, '中国')
  assert.equal(info?.organization, 'Zenlayer Inc')
})
