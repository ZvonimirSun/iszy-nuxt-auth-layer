import type { Fetcher } from '##shared/types/fetcher'
import ipaddr from 'ipaddr.js'

export const DEFAULT_GEOJS_ORIGIN = 'https://get.geojs.io'

export interface GeoJsResponse {
  ip?: string
  country?: string
  country_code?: string
  country_code3?: string
  continent_code?: string
  region?: string
  city?: string
  latitude?: string
  longitude?: string
  accuracy?: number
  timezone?: string
  organization?: string
  organization_name?: string
}

export interface IpGeoInfo {
  ip: string
  label: string
  country?: string
  countryCode?: string
  region?: string
  city?: string
  organization?: string
  isLocal?: boolean
}

export interface ParsedDeviceIp {
  ip: string
  localLabel?: string
}

export interface LookupIpGeoOptions {
  origin?: string
  fetcher?: Fetcher
}

const LOCAL_IP_LABELS: Record<string, string> = {
  loopback: '本地',
  private: '内网',
  uniqueLocal: '内网',
  linkLocal: '本地链路',
  carrierGradeNat: '内网',
  unspecified: '保留地址',
  broadcast: '保留地址',
  multicast: '保留地址',
  reserved: '保留地址',
  benchmarking: '保留地址',
}

const geoCache = new Map<string, IpGeoInfo>()
const pendingRequests = new Map<string, Promise<IpGeoInfo | null>>()

let regionDisplayNames: Intl.DisplayNames | null | undefined

function normalizeGeoField(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === 'Unknown' || trimmed === 'nil') {
    return ''
  }
  return trimmed
}

function getLocalizedCountry(countryCode?: string, fallbackCountry?: string) {
  const code = countryCode?.trim().toUpperCase()
  if (code && /^[A-Z]{2}$/.test(code)) {
    if (regionDisplayNames === undefined) {
      try {
        regionDisplayNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
          ? new Intl.DisplayNames(['zh-CN'], { type: 'region', style: 'short' })
          : null
      }
      catch {
        regionDisplayNames = null
      }
    }
    try {
      const localized = regionDisplayNames?.of(code)
      if (localized && localized !== code) {
        return localized
      }
    }
    catch {}
  }
  return normalizeGeoField(fallbackCountry)
}

export function parseDeviceIp(raw?: string): ParsedDeviceIp | null {
  const value = raw?.trim()
  if (!value) {
    return null
  }

  let parsed: ipaddr.IPv4 | ipaddr.IPv6
  if (ipaddr.isValidCIDR(value)) {
    parsed = ipaddr.parseCIDR(value)[0]
  }
  else if (ipaddr.isValid(value)) {
    parsed = ipaddr.process(value)
  }
  else {
    return null
  }

  const addr = parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()
    ? parsed.toIPv4Address()
    : parsed

  const normalized = addr instanceof ipaddr.IPv6
    ? addr.toRFC5952String()
    : addr.toString()

  return {
    ip: normalized,
    localLabel: LOCAL_IP_LABELS[addr.range()],
  }
}

export function resolveGeoJsOrigin(origin?: string) {
  const trimmed = origin?.trim()
  return (trimmed || DEFAULT_GEOJS_ORIGIN).replace(/\/+$/, '')
}

export function buildGeoJsUrl(ip: string, origin?: string) {
  const base = resolveGeoJsOrigin(origin)
  const encodedIp = encodeURIComponent(ip)
  if (base.endsWith('.json')) {
    const separator = base.includes('?') ? '&' : '?'
    return `${base}${separator}ip=${encodedIp}`
  }
  if (base.endsWith('/v1/ip/geo')) {
    return `${base}/${encodedIp}.json`
  }
  return `${base}/v1/ip/geo/${encodedIp}.json`
}

export function formatGeoLocation(data: GeoJsResponse) {
  const country = getLocalizedCountry(data.country_code, data.country)
  const region = normalizeGeoField(data.region)
  const city = normalizeGeoField(data.city)
  const parts: string[] = []
  for (const part of [country, region, city]) {
    if (part && !parts.includes(part)) {
      parts.push(part)
    }
  }
  return parts.join(' / ')
}

function getCacheKey(ip: string, origin?: string) {
  return `${resolveGeoJsOrigin(origin)}|${ip}`
}

export function getCachedIpGeo(rawIp?: string, origin?: string): IpGeoInfo | undefined {
  const parsed = parseDeviceIp(rawIp)
  if (!parsed) {
    return undefined
  }
  if (parsed.localLabel) {
    return {
      ip: parsed.ip,
      label: parsed.localLabel,
      isLocal: true,
    }
  }
  return geoCache.get(getCacheKey(parsed.ip, origin))
}

export async function lookupIpGeo(
  rawIp?: string,
  options: LookupIpGeoOptions = {},
): Promise<IpGeoInfo | null> {
  const parsed = parseDeviceIp(rawIp)
  if (!parsed) {
    return null
  }
  if (parsed.localLabel) {
    return {
      ip: parsed.ip,
      label: parsed.localLabel,
      isLocal: true,
    }
  }

  const cacheKey = getCacheKey(parsed.ip, options.origin)
  const cached = geoCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const inFlight = pendingRequests.get(cacheKey)
  if (inFlight) {
    return inFlight
  }

  const fetcher = options.fetcher ?? $fetch
  const url = buildGeoJsUrl(parsed.ip, options.origin)
  const request = (async (): Promise<IpGeoInfo | null> => {
    const response = await fetcher<GeoJsResponse | GeoJsResponse[]>(url)
    const data = Array.isArray(response) ? response[0] : response
    if (!data || typeof data !== 'object') {
      return null
    }
    const countryCode = normalizeGeoField(data.country_code) || undefined
    const country = getLocalizedCountry(data.country_code, data.country) || undefined
    const region = normalizeGeoField(data.region) || undefined
    const city = normalizeGeoField(data.city) || undefined
    const organization = normalizeGeoField(data.organization_name) || undefined
    const info: IpGeoInfo = {
      ip: parsed.ip,
      label: formatGeoLocation(data),
      country,
      countryCode,
      region,
      city,
      organization,
    }
    geoCache.set(cacheKey, info)
    return info
  })()

  const tracked = request.finally(() => {
    if (pendingRequests.get(cacheKey) === tracked) {
      pendingRequests.delete(cacheKey)
    }
  })

  pendingRequests.set(cacheKey, tracked)
  return tracked
}

export function clearIpGeoCache() {
  geoCache.clear()
  pendingRequests.clear()
}
