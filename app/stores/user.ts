import type { Device, PublicUser, ResultDto } from '@zvonimirsun/iszy-common'
import type { AuthFeatures, PublicSimpleUser, UpdateUser } from '##shared/types/auth'
import type { Fetcher } from '##shared/types/fetcher'
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

function formatDeviceTime(value?: string | number | Date) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const pad = (item: number) => item.toString().padStart(2, '0')
  return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const useUserStore = defineStore('user', () => {
  const profilePulled = ref(false)
  const profile = ref<PublicSimpleUser>()
  const authFeatures = ref<AuthFeatures>()
  const logged = computed(() => {
    return !!profile.value
  })

  let pullProfilePromise: Promise<ResultDto<{
    logged: boolean
    profile?: PublicSimpleUser
  }>> | null = null
  let authFeaturesPromise: Promise<AuthFeatures> | null = null
  let pullProfileAbortController: AbortController | null = null // 用于中断请求

  async function login({ userName, password }: {
    userName: string
    password: string
  }) {
    let error = ''
    try {
      if (userName && password) {
        const res = await $fetch<ResultDto<LoginResultData>>(`/api/auth/login`, {
          method: 'post',
          body: {
            userName: userName.trim(),
            password,
          },
        })
        if (res.success) {
          profilePulled.value = true
          const nextProfile = res.data as PublicSimpleUser
          await updateProfile(nextProfile)
          authEvents.emit('loginSuccess', { profile: nextProfile })
          return
        }
        else {
          removeProfile()
          error = formatLoginFailureMessage(res.message, res.data)
        }
      }
      else {
        error = '请输入用户名和密码'
      }
    }
    catch (e) {
      removeProfile()
      throw e
    }
    throw new Error(error)
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
    const data = await $fetch<ResultDto<void>>(`/api/auth/logout`, {
      method: 'POST',
    })
    if (data && data.success) {
      await removeProfile()
      authEvents.emit('logoutSuccess', undefined)
    }
    else {
      throw new Error(data?.message || '登出失败')
    }
  }

  async function getAuthFeatures(force = false, fetcher: Fetcher = $fetch) {
    if (authFeatures.value && !force) {
      return authFeatures.value
    }
    if (authFeaturesPromise && !force) {
      return authFeaturesPromise
    }

    authFeaturesPromise = (async () => {
      const res = await fetcher<ResultDto<AuthFeatures>>('/api/auth/features')
      if (!res.success || !res.data) {
        throw new Error(res.message || '获取认证配置失败')
      }
      authFeatures.value = res.data
      return res.data
    })()

    try {
      return await authFeaturesPromise
    }
    finally {
      authFeaturesPromise = null
    }
  }

  function pullProfile(force = false, fetcher: Fetcher = $fetch) {
    if (profilePulled.value && !force) {
      return Promise.resolve({
        success: true,
        data: { logged: logged.value, profile: profile.value },
        message: '',
      })
    }
    if (pullProfilePromise && !force) {
      return pullProfilePromise
    }

    pullProfileAbortController?.abort()
    const controller = new AbortController()
    pullProfileAbortController = controller
    const request = (async () => {
      const res = await fetcher<ResultDto<{
        logged: boolean
        profile?: PublicSimpleUser
      }>>('/api/auth/check', { signal: controller.signal })
      if (controller.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      if (!res.success || !res.data) {
        throw new Error(res.message || '获取登录状态失败')
      }
      profile.value = res.data.logged ? res.data.profile : undefined
      profilePulled.value = true
      authEvents.emit('profileUpdated', { profile: profile.value, fetcher })
      return res
    })()
    const pending = request.finally(() => {
      if (pullProfileAbortController === controller) {
        pullProfileAbortController = null
        pullProfilePromise = null
      }
    })
    pullProfilePromise = pending
    return pending
  }

  async function updateProfile(data?: PublicSimpleUser, fetcher?: Fetcher) {
    pullProfileAbortController?.abort()
    pullProfileAbortController = null
    pullProfilePromise = null
    profilePulled.value = true
    profile.value = data
    authEvents.emit('profileUpdated', {
      profile: data,
      fetcher,
    })
  }

  async function removeProfile(fetcher?: Fetcher) {
    await updateProfile(undefined, fetcher)
    authEvents.emit('profileRemoved', {
      fetcher,
    })
  }

  async function thirdPartyUnbind(type: string) {
    await $fetch<{
      success: boolean
    }>('/api/oauth/unbind', {
      method: 'POST',
      body: {
        provider: type,
      },
    })
    await pullProfile(true)
  }

  async function updateCurrentUser(profile: UpdateUser) {
    const res = await $fetch<ResultDto<PublicUser>>('/api/user/me', {
      method: 'PUT',
      body: profile,
    })
    if (!res.success || !res.data) {
      throw new Error(res.message || '更新账户信息失败')
    }
    await updateProfile(res.data)
    return res.data
  }

  async function getDevices(): Promise<(Device & {
    createTime?: string
    lastLoginTime?: string
  })[]> {
    const res = await $fetch<ResultDto<Device[]>>(`/api/auth/devices`)
    return res.data!.map((device: Device & {
      createTime?: string
      lastLoginTime?: string
    }) => {
      if (!device.ip) {
        device.ip = '未知'
      }
      device.createTime = formatDeviceTime(device.createdAt)
      device.lastLoginTime = formatDeviceTime(device.updatedAt)
      return device
    })
  }

  async function removeDevice({ deviceId, other }: {
    deviceId?: string
    all?: boolean
    other?: boolean
  }) {
    if (other) {
      await $fetch(`/api/auth/logout`, {
        method: 'POST',
        query: {
          other,
        },
      })
      return
    }
    if (deviceId) {
      await $fetch(`/api/auth/logout`, {
        method: 'POST',
        query: {
          deviceId,
        },
      })
    }
  }

  return {
    profilePulled,
    profile,
    authFeatures,
    logged,
    login,
    logout,
    getAuthFeatures,
    pullProfile,
    updateProfile,
    removeProfile,
    updateCurrentUser,
    thirdPartyUnbind,
    getDevices,
    removeDevice,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUserStore, import.meta.hot))
}
