<script setup lang="ts">
import type { AuthFormField, ButtonProps, FormSubmitEvent } from '@nuxt/ui'
import type { LocationQuery } from 'vue-router'
import * as z from 'zod'
import { useUserStore } from '##stores/user'

const { title } = usePublicConfig()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const userStore = useUserStore()
const authFeatures = await userStore.getAuthFeatures()
const seoTitle = computed(() => `用户登录 - ${title}`)
const seoDescription = '登录账号后可使用需要权限的在线工具，管理个人设置、第三方账号绑定和设备会话。'
const publicRegister = computed(() => authFeatures.publicRegister)
const isSsoMode = computed(() => authFeatures.authMode === 'sso')

useSeoMeta({
  title: () => seoTitle.value,
  ogTitle: () => seoTitle.value,
  description: seoDescription,
  ogDescription: seoDescription,
  robots: 'noindex,nofollow',
})

const redirect = ref<string>()
const otherQuery = ref({})
const error = ref<string>()
const loading = ref(false)
const activeLoginTab = ref(isSsoMode.value ? 'sso' : 'local')
let pollIndex: number | null = null

const query = route.query
if (query) {
  if (typeof query.redirect === 'string') {
    redirect.value = query.redirect
  }
  otherQuery.value = _getOtherQuery(query)
}

const fields: AuthFormField[] = [{
  name: 'userName',
  type: 'text',
  label: '用户名',
}, {
  name: 'password',
  label: '密码',
  type: 'password',
}]

const providers: ButtonProps[] = [
  {
    label: 'GitHub',
    icon: 'i-simple-icons:github',
    onClick: () => {
      thirdPartyLogin('/api/oauth/github', 'GitHub 登录')
    },
  },
  {
    label: 'Linux Do',
    icon: 'i-iszy-auth:linuxdo',
    onClick: () => {
      thirdPartyLogin('/api/oauth/linuxdo', 'LINUX DO 登录')
    },
  },
]

const loginTabItems = [
  {
    label: '统一登录',
    icon: 'i-lucide:shield-check',
    value: 'sso',
  },
  {
    label: '账号登录',
    icon: 'i-lucide:lock-keyhole',
    value: 'local',
  },
]

const schema = z.object({
  userName: z.string('请输入用户名'),
  password: z.string('请输入密码'),
})

type Schema = z.output<typeof schema>

onMounted(() => {
  if (userStore.logged) {
    router.push({ path: redirect.value || '/', query: otherQuery.value })
    toast.add({ title: '已登录', description: '您已经登录，无需再次登录', color: 'info' })
  }
})

onBeforeUnmount(() => {
  if (pollIndex != null) {
    clearInterval(pollIndex)
    pollIndex = null
  }
  window.removeEventListener('message', thirdPartyLoginCallback)
})

async function login(payload: FormSubmitEvent<Schema>) {
  if (loading.value) {
    return
  }
  if (!navigator.onLine) {
    toast.add({ title: '网络异常', description: '请检查您的网络连接', color: 'error' })
    return
  }
  try {
    loading.value = true
    error.value = undefined
    await userStore.login(payload.data)
    _afterLogin()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  }
  finally {
    loading.value = false
  }
}

function thirdPartyLogin(url: string, title = '第三方登录', width = 500, height = 600) {
  if (loading.value) {
    toast.add({ title: '登录中', description: '登录进行中，请勿重复点击', color: 'warning' })
    return
  }
  loading.value = true
  error.value = undefined
  window.addEventListener('message', thirdPartyLoginCallback)
  const top = (window.screen.height - height) / 2
  const left = (window.screen.width - width) / 2
  const page = window.open(url, title, `popup,width=${width},height=${height},top=${top},left=${left}`)
  if (!page) {
    loading.value = false
    toast.add({ title: '登录失败', description: '请允许浏览器弹出窗口！', color: 'error' })
    return
  }
  pollIndex = window.setInterval(() => {
    if (page.closed) {
      loading.value = false
      if (pollIndex != null) {
        clearInterval(pollIndex)
        pollIndex = null
      }
    }
  }, 500)
}

function ssoLogin() {
  thirdPartyLogin('/api/oauth/sso', `${authFeatures.sso.title} 登录`, 560, 760)
}

async function thirdPartyLoginCallback(e: MessageEvent<{
  success: boolean
  message?: string
}>) {
  const page = e.source as Window
  if (e.origin !== window.location.origin) {
    return
  }
  if (e.data.success == null) {
    return
  }
  loading.value = false
  window.removeEventListener('message', thirdPartyLoginCallback)
  if (pollIndex != null) {
    clearInterval(pollIndex)
    pollIndex = null
  }
  page.close()
  if (e.data.success) {
    await userStore.pullProfile(true)
    _afterLogin()
  }
  else {
    error.value = e.data.message || '登录失败'
  }
}

function _afterLogin() {
  toast.add({ title: '登录成功', description: '欢迎回来！', color: 'success' })
  router.push({ path: redirect.value || '/', query: otherQuery.value })
}

function _getOtherQuery(query: LocationQuery) {
  const { redirect, ...result } = query
  return result
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <template v-if="isSsoMode">
        <div data-slot="header" class="mb-4 flex flex-col text-center">
          <div data-slot="leading" class="mb-2">
            <UIcon name="i-lucide:lock" data-slot="leadingIcon" class="size-8 shrink-0 inline-block" />
          </div>
          <div data-slot="title" class="text-xl text-pretty font-semibold text-highlighted">
            欢迎回来！
          </div>
        </div>
        <UTabs
          v-model="activeLoginTab"
          class="mb-4"
          :content="false"
          :items="loginTabItems"
        />
        <div v-if="activeLoginTab === 'sso'" class="flex flex-col gap-4">
          <UAlert v-if="error" color="error" icon="i-lucide:info" :title="error" />
          <UButton
            block
            size="lg"
            icon="i-lucide:shield-check"
            :loading="loading"
            @click="ssoLogin"
          >
            {{ authFeatures.sso.title }}
          </UButton>
        </div>
        <UAuthForm
          v-else
          :schema="schema"
          :fields="fields"
          :providers="providers"
          :loading="loading"
          separator="或"
          :submit="{
            label: '登录',
          }"
          @submit="login"
        >
          <template v-if="publicRegister" #footer>
            没有账户？<ULink to="/register" class="text-primary font-medium">
              注册
            </ULink>.
          </template>
          <template v-if="error" #validation>
            <UAlert color="error" icon="i-lucide:info" :title="error" />
          </template>
        </UAuthForm>
      </template>
      <UAuthForm
        v-else
        :schema="schema"
        title="欢迎回来！"
        icon="i-lucide:lock"
        :fields="fields"
        :providers="providers"
        :loading="loading"
        separator="或"
        :submit="{
          label: '登录',
        }"
        @submit="login"
      >
        <template v-if="publicRegister" #footer>
          没有账户？<ULink to="/register" class="text-primary font-medium">
            注册
          </ULink>.
        </template>
        <template v-if="error" #validation>
          <UAlert color="error" icon="i-lucide:info" :title="error" />
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>

<style scoped lang="scss">

</style>
