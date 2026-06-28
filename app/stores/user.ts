import type { Device, ResultDto } from '@zvonimirsun/iszy-common'
import type { PublicSimpleUser } from '##shared/types/auth'
import dayjs from 'dayjs'
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

export const useUserStore = defineStore('user', () => {
  const profilePulled = ref(false)
  const profile = ref<PublicSimpleUser>()
  const logged = computed(() => {
    return !!profile.value
  })

  let pullProfilePromise: Promise<ResultDto<{
    logged: boolean
    profile?: PublicSimpleUser
  }>> | null = null
  let pullProfileResolve: ((value: ResultDto<{ logged: boolean, profile?: PublicSimpleUser }>) => void) | null
  let pullProfileReject: ((value: unknown) => void) | null
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

  async function pullProfile(force?: boolean, fetcher: typeof $fetch = $fetch) {
    // 1. 非强制刷新且已拉取成功，直接返回
    if (profilePulled.value && !force) {
      return true
    }

    // 2. 强制刷新：中断正在进行的请求并重置状态
    if (force) {
      // 中断之前的请求
      if (pullProfileAbortController) {
        pullProfileAbortController.abort()
        pullProfileAbortController = null
      }
      // 重置 Promise 相关状态
      pullProfilePromise = null
      pullProfileResolve = null
      pullProfileReject = null
    }

    // 3. 非强制刷新且已有请求中，返回现有 Promise
    if (pullProfilePromise && !force) {
      return pullProfilePromise
    }

    // 4. 创建新的 Promise 并发起请求
    pullProfilePromise = new Promise<ResultDto<{
      logged: boolean
      profile?: PublicSimpleUser
    }>>((resolve, reject) => {
      pullProfileResolve = resolve
      pullProfileReject = reject
    })
    try {
      // 创建 AbortController 用于中断请求
      pullProfileAbortController = new AbortController()
      const res = await fetcher<ResultDto<{
        logged: boolean
        profile?: PublicSimpleUser
      }>>(`/api/auth/check`, {
        signal: pullProfileAbortController.signal, // 关联中断信号
      })
      if (res && res.success) {
        await updateProfile(res.data?.profile, fetcher)
        profilePulled.value = true
        // 安全调用 resolve（避免空值）
        pullProfileResolve?.(res)
      }
      else {
        await removeProfile(fetcher)
        // 安全调用 reject
        pullProfileReject?.(new Error(res?.message || '拉取用户信息失败'))
      }
    }
    catch (error) {
      // 处理中断错误（无需提示，属于正常取消）
      if ((error as Error).name !== 'AbortError') {
        await removeProfile(fetcher)
        console.error('拉取用户信息异常:', error)
      }
      // 安全调用 reject
      pullProfileReject?.(error)
    }
    finally {
      // 清理资源
      pullProfileAbortController = null
      pullProfileResolve = null
      pullProfileReject = null
      // 关键：请求完成后重置 Promise（避免复用旧 Promise）
      pullProfilePromise = null
    }
    return pullProfilePromise
  }

  async function updateProfile(data?: PublicSimpleUser, fetcher?: typeof $fetch) {
    profile.value = data
    authEvents.emit('profileUpdated', {
      profile: data,
      fetcher,
    })
  }

  async function removeProfile(fetcher?: typeof $fetch) {
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
      device.createTime = dayjs(device.createdAt!).format('YYYY年MM月DD日 HH:mm')
      device.lastLoginTime = dayjs(device.updatedAt!).format('YYYY年MM月DD日 HH:mm')
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
