import type { Device, ResultDto } from '@zvonimirsun/iszy-common'
import type { PublicSimpleUser } from '#shared/types/auth'
import { acceptHMRUpdate, defineStore } from 'pinia'

interface LoginAttemptFailureData {
  code: 'LOGIN_FAILED'
  failedCount: number
  remainingAttempts: number
  maxAttempts: number
  windowSeconds: number
}

interface LoginBanFailureData {
  code: 'LOGIN_BANNED'
  retryAfterSeconds: number
  bannedUntil: string
}

type LoginFailureData = LoginAttemptFailureData | LoginBanFailureData
type LoginResultData = PublicSimpleUser | LoginFailureData

type ProfileFetcher = <T>(request: string, opts?: {
  signal?: AbortSignal
}) => Promise<T>

const appFetch = $fetch as unknown as <T>(request: string, opts?: Record<string, unknown>) => Promise<T>

export const useUserStore = defineStore('user', () => {
  const profilePulled = ref(false)
  const profile = ref<PublicSimpleUser>()
  const logged = computed(() => !!profile.value)

  let pullProfilePromise: Promise<boolean> | null = null
  let pullProfileAbortController: AbortController | null = null

  async function login(payload: {
    userName: string
    password: string
  }) {
    const { userName, password } = payload
    if (!userName || !password) {
      throw new Error('请输入用户名和密码')
    }

    try {
      const res = await appFetch<ResultDto<LoginResultData>>('/api/auth/login', {
        method: 'post',
        body: {
          userName: userName.trim(),
          password,
        },
      })

      if (res.success) {
        profilePulled.value = true
        updateProfile(res.data as PublicSimpleUser)
        return
      }

      removeProfile()
      throw new Error(formatLoginFailureMessage(res.message, res.data))
    }
    catch (error) {
      removeProfile()
      throw error
    }
  }

  function formatLoginFailureMessage(message: string, data?: LoginResultData) {
    const fallbackMessage = message || '登录失败'
    if (!data || !('code' in data)) {
      return fallbackMessage
    }

    if (data.code === 'LOGIN_BANNED') {
      return '登录失败次数过多，请稍后再试。'
    }

    return fallbackMessage
  }

  async function logout() {
    const res = await appFetch<ResultDto<void>>('/api/auth/logout', {
      method: 'POST',
    })

    if (res?.success) {
      removeProfile()
      return
    }

    throw new Error(res?.message || '登出失败')
  }

  async function pullProfile(force = false, fetcher: ProfileFetcher = appFetch) {
    if (profilePulled.value && !force) {
      return logged.value
    }

    if (force) {
      pullProfileAbortController?.abort()
      pullProfileAbortController = null
      pullProfilePromise = null
    }

    if (pullProfilePromise && !force) {
      return pullProfilePromise
    }

    pullProfileAbortController = new AbortController()
    pullProfilePromise = (async () => {
      try {
        const res = await fetcher<ResultDto<{
          logged: boolean
          profile?: PublicSimpleUser
        }>>('/api/auth/check', {
          signal: pullProfileAbortController!.signal,
        })

        if (res?.success && res.data?.logged) {
          updateProfile(res.data.profile)
          profilePulled.value = true
          return true
        }

        removeProfile()
        profilePulled.value = true
        return false
      }
      catch (error) {
        if ((error as Error).name !== 'AbortError') {
          removeProfile()
          profilePulled.value = true
        }
        throw error
      }
      finally {
        pullProfileAbortController = null
        pullProfilePromise = null
      }
    })()

    return pullProfilePromise
  }

  function updateProfile(data?: PublicSimpleUser) {
    profile.value = data
  }

  function removeProfile() {
    updateProfile(undefined)
  }

  async function thirdPartyUnbind(type: string) {
    await appFetch<ResultDto<void>>('/api/oauth/unbind', {
      method: 'POST',
      body: {
        provider: type,
      },
    })
    await pullProfile(true)
  }

  async function getDevices(): Promise<Device[]> {
    const res = await appFetch<ResultDto<Device[]>>('/api/auth/devices')
    return res.data || []
  }

  async function removeDevice({ deviceId, other }: {
    deviceId?: string
    all?: boolean
    other?: boolean
  }) {
    await appFetch('/api/auth/logout', {
      method: 'POST',
      query: {
        deviceId,
        other,
      },
    })
  }

  return {
    profilePulled,
    profile,
    logged,
    login,
    logout,
    pullProfile,
    updateProfile,
    removeProfile,
    thirdPartyUnbind,
    getDevices,
    removeDevice,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUserStore, import.meta.hot))
}
