<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ResultDto } from '@zvonimirsun/iszy-common'
import type {
  PublicSimpleUser,
  SsoCompletionBindBody,
  SsoCompletionCreateBody,
  SsoCompletionProfile,
} from '##shared/types/auth'
import * as z from 'zod'

definePageMeta({
  layout: false,
})

const { title } = usePublicConfig()
const route = useRoute()
const requestFetch = useRequestFetch()
const step = ref<'choice' | 'bind' | 'create'>('choice')
const loading = ref(false)
const submitError = ref<string>()
const completionExpired = ref(false)
const flowId = typeof route.query.flow === 'string' ? route.query.flow : ''
const completionQuery = `?flow=${encodeURIComponent(flowId)}`

useSeoMeta({
  title: () => `完成 SSO 登录 - ${title}`,
  robots: 'noindex,nofollow',
})
useHead({
  meta: [
    { name: 'referrer', content: 'no-referrer' },
  ],
})

const { data: profile, error: profileError } = await useAsyncData('sso-completion-profile', async () => {
  try {
    const res = await requestFetch<ResultDto<SsoCompletionProfile>>(`/api/oauth/sso/completion${completionQuery}`)
    if (!res.success || !res.data) {
      throw new Error(res.message || '获取 SSO 账户信息失败')
    }
    return res.data
  }
  catch (error) {
    if (getErrorStatus(error) === 410) {
      completionExpired.value = true
    }
    throw new Error(getErrorMessage(error, '获取 SSO 账户信息失败'))
  }
})

const bindState = reactive<SsoCompletionBindBody>({
  username: profile.value?.email || profile.value?.suggestedUserName || '',
  password: '',
  useSsoNickname: true,
})
const createState = reactive<SsoCompletionCreateBody>({
  userName: profile.value?.suggestedUserName || '',
  nickName: profile.value?.nickName || '',
  email: profile.value?.email || '',
  passwd: '',
})

const bindSchema = z.object({
  username: z.string().trim().min(1, '请输入用户名或邮箱'),
  password: z.string().min(1, '请输入密码'),
  useSsoNickname: z.boolean().optional(),
})
const createSchema = z.object({
  userName: z.string().trim().min(1, '请输入用户名'),
  nickName: z.string().trim().min(1, '请输入昵称'),
  email: z.string().trim().refine(value => !value || z.email().safeParse(value).success, '请输入有效的邮箱地址'),
  passwd: z.string().min(1, '请输入密码'),
})

type BindSchema = z.output<typeof bindSchema>
type CreateSchema = z.output<typeof createSchema>

const pageTitle = computed(() => `完成 ${profile.value?.providerTitle || 'SSO'} 登录`)
const suggestedEmail = computed(() => profile.value?.email || '未提供')
const terminalError = computed(() => profileError.value?.message || (completionExpired.value ? 'SSO 登录流程无效或已过期' : ''))

function selectStep(nextStep: 'bind' | 'create') {
  submitError.value = undefined
  step.value = nextStep
}

function goBack() {
  submitError.value = undefined
  step.value = 'choice'
}

async function bindAccount(payload: FormSubmitEvent<BindSchema>) {
  await submitCompletion('/api/oauth/sso/completion/bind', payload.data)
}

async function createAccount(payload: FormSubmitEvent<CreateSchema>) {
  await submitCompletion('/api/oauth/sso/completion/create', {
    ...payload.data,
    email: payload.data.email || undefined,
  })
}

async function submitCompletion(url: string, body: SsoCompletionBindBody | SsoCompletionCreateBody) {
  if (loading.value) {
    return
  }

  loading.value = true
  submitError.value = undefined
  try {
    const res = await $fetch<ResultDto<PublicSimpleUser>>(`${url}${completionQuery}`, {
      method: 'POST',
      body,
    })
    if (!res.success || !res.data) {
      throw new Error(res.message || 'SSO 登录失败')
    }
    await finishLogin()
  }
  catch (error) {
    if (getErrorStatus(error) === 410) {
      completionExpired.value = true
    }
    submitError.value = getErrorMessage(error, 'SSO 登录失败')
  }
  finally {
    loading.value = false
  }
}

async function finishLogin() {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ success: true }, window.location.origin)
    window.close()
    return
  }
  await navigateTo('/')
}

async function returnToLogin() {
  const message = terminalError.value || submitError.value || 'SSO 登录未完成'
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ success: false, message }, window.location.origin)
    window.close()
    return
  }
  await navigateTo('/login')
}

function getErrorStatus(error: unknown) {
  const normalized = error as {
    status?: number
    statusCode?: number
    response?: { status?: number }
  }
  return normalized.statusCode || normalized.status || normalized.response?.status
}

function getErrorMessage(error: unknown, fallback: string) {
  const normalized = error as {
    data?: { message?: string }
    message?: string
  }
  return normalized.data?.message || normalized.message || fallback
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <UPageCard class="w-full max-w-lg">
      <div class="flex flex-col gap-5">
        <div class="flex flex-col items-center text-center gap-2">
          <UIcon name="i-lucide:shield-check" class="size-9 text-primary" />
          <h1 class="text-xl text-pretty font-semibold text-highlighted">
            {{ pageTitle }}
          </h1>
          <p class="text-sm text-muted">
            选择绑定已有账户，或创建一个新账户继续登录。
          </p>
        </div>

        <template v-if="profile && !completionExpired">
          <div class="rounded-lg border border-default bg-muted/30 p-4">
            <div class="text-sm font-medium text-highlighted">
              {{ profile.providerTitle }} 账户
            </div>
            <div class="mt-2 text-base text-highlighted break-words">
              {{ profile.nickName }}
            </div>
            <div class="mt-1 text-sm text-muted break-all">
              建议邮箱：{{ suggestedEmail }}
            </div>
          </div>

          <template v-if="step === 'choice'">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UButton
                block
                color="neutral"
                variant="outline"
                icon="i-lucide:log-in"
                @click="selectStep('bind')"
              >
                绑定已有账户
              </UButton>
              <UButton
                block
                icon="i-lucide:user-plus"
                @click="selectStep('create')"
              >
                创建新账户
              </UButton>
            </div>
          </template>

          <UForm
            v-else-if="step === 'bind'"
            :schema="bindSchema"
            :state="bindState"
            class="flex flex-col gap-4"
            @submit="bindAccount"
          >
            <p class="text-sm text-muted">
              登录已有账户，并将本次 {{ profile.providerTitle }} 登录与其绑定。
            </p>
            <UFormField label="用户名或邮箱" name="username" required>
              <UInput
                v-model="bindState.username"
                class="w-full"
                autocomplete="username"
                placeholder="请输入用户名或邮箱"
              />
            </UFormField>
            <UFormField label="密码" name="password" required>
              <UInput
                v-model="bindState.password"
                class="w-full"
                type="password"
                autocomplete="current-password"
                placeholder="请输入密码"
              />
            </UFormField>
            <UCheckbox
              v-model="bindState.useSsoNickname"
              :label="`使用 ${profile.providerTitle} 昵称：${profile.nickName}`"
            />
            <UAlert v-if="submitError" color="error" icon="i-lucide:info" :title="submitError" />
            <div class="grid grid-cols-2 gap-3">
              <UButton block color="neutral" variant="outline" type="button" :disabled="loading" @click="goBack">
                返回
              </UButton>
              <UButton block type="submit" :loading="loading">
                登录并绑定
              </UButton>
            </div>
          </UForm>

          <UForm
            v-else
            :schema="createSchema"
            :state="createState"
            class="flex flex-col gap-4"
            @submit="createAccount"
          >
            <p class="text-sm text-muted">
              创建新账户后会自动绑定 {{ profile.providerTitle }} 并完成登录。
            </p>
            <UFormField label="用户名" name="userName" required>
              <UInput v-model="createState.userName" class="w-full" autocomplete="username" placeholder="请输入用户名" />
            </UFormField>
            <UFormField label="昵称" name="nickName" required>
              <UInput v-model="createState.nickName" class="w-full" autocomplete="nickname" placeholder="请输入昵称" />
            </UFormField>
            <UFormField label="邮箱" name="email">
              <UInput v-model="createState.email" class="w-full" type="email" autocomplete="email" placeholder="请输入邮箱（可选）" />
            </UFormField>
            <UFormField label="密码" name="passwd" required>
              <UInput v-model="createState.passwd" class="w-full" type="password" autocomplete="new-password" placeholder="请输入密码" />
            </UFormField>
            <UAlert v-if="submitError" color="error" icon="i-lucide:info" :title="submitError" />
            <div class="grid grid-cols-2 gap-3">
              <UButton block color="neutral" variant="outline" type="button" :disabled="loading" @click="goBack">
                返回
              </UButton>
              <UButton block type="submit" :loading="loading">
                创建并登录
              </UButton>
            </div>
          </UForm>
        </template>

        <template v-else>
          <UAlert
            color="error"
            icon="i-lucide:circle-alert"
            title="无法继续 SSO 登录"
            :description="terminalError || 'SSO 登录流程无效或已过期'"
          />
          <UButton block color="neutral" variant="outline" @click="returnToLogin">
            返回登录页重试
          </UButton>
        </template>

      </div>
    </UPageCard>
  </div>
</template>
