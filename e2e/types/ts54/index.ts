import {
  getAsyncDataContext,
  unFirstArgumentEnhanced,
  useAsync,
  useAsyncData,
  useAsyncFunction,
  withAddonGroup,
} from 'vue-asyncx'

// --- useAsync: 默认名称 'method' ---
const methodResult = useAsync(async () => true)
const _method: () => Promise<boolean> = methodResult.method
const _methodLoading: boolean = methodResult.methodLoading.value
const _methodError: any = methodResult.methodError.value

// --- useAsync: 自定义名称 ---
const submitResult = useAsync('submit', async (id: string, payload: { force?: boolean }) => true, {
  immediate: false,
})
const _submit: (id: string, payload: { force?: boolean }) => Promise<boolean> = submitResult.submit
const _submitLoading: boolean = submitResult.submitLoading.value
const _submitArguments: [string, { force?: boolean }] = submitResult.submitArguments.value
const _submitArgumentFirst: string | undefined = submitResult.submitArgumentFirst.value
const _submitError: any = submitResult.submitError.value

// --- useAsync: 带 addons (withAddonGroup) ---
const method = useAsync('submit', async () => true, {
  addons: [
    withAddonGroup({
      key: () => 'fixed',
    }),
  ],
})
const _submitGroup = method.submitGroup.value
const _clearSubmitGroup: (key?: string | number) => void = method.clearSubmitGroup

// --- withAddonGroup: scope 可选参数 ---
const scopedResult = useAsync('confirm', async (id: string) => true, {
  addons: [
    withAddonGroup({
      key: (args) => args[0],
      scope: (args) => args[0],
    }),
  ],
})
const _confirmGroup = scopedResult.confirmGroup.value
scopedResult.clearConfirmGroup('item1')

// --- useAsync: watch + immediate ---
const initResult = useAsync('init', async () => ({ ok: true }), {
  watch: () => 'dep',
  immediate: true,
})
const _init: () => Promise<{ ok: boolean }> = initResult.init

// --- useAsyncFunction: useAsync 别名 ---
const confirmResult = useAsyncFunction('confirm', async () => true)
const _confirm: () => Promise<boolean> = confirmResult.confirm

// --- useAsyncData: 默认名称 'data' ---
const dataResult = useAsyncData(async () => ({ name: 'Mike' }))
const _data: { name: string } = dataResult.data.value
const _queryData: () => Promise<{ name: string }> = dataResult.queryData
const _queryDataLoading: boolean = dataResult.queryDataLoading.value
const _dataExpired: boolean = dataResult.dataExpired.value

// --- useAsyncData: 自定义名称 ---
const data = useAsyncData('user', async () => ({ name: 'Mike' }), {
  addons: [
    withAddonGroup({
      key: () => 'fixed',
    }),
  ],
})
const _user: { name: string } = data.user.value
const _queryUser: () => Promise<{ name: string }> = data.queryUser
const _userGroup = data.userGroup.value
const _clearUserGroup = data.clearUserGroup

// --- useAsyncData: 带参数 ---
const userByIdResult = useAsyncData('userById', (id: string) =>
  Promise.resolve({ id, name: 'Mike' })
)
const _queryUserById: (id: string) => Promise<{ id: string; name: string }> =
  userByIdResult.queryUserById
userByIdResult.queryUserById('1')

// --- useAsyncData: initialData + shallow ---
const shallowResult = useAsyncData(
  'list',
  async () => [{ id: 1 }],
  { initialData: [], shallow: true }
)
const _list: { id: number }[] = shallowResult.list.value
const _queryList: () => Promise<{ id: number }[]> = shallowResult.queryList

// --- getAsyncDataContext ---
useAsyncData('ctx', async () => {
  const ctx = getAsyncDataContext()
  if (ctx) {
    const current = ctx.getData()
    ctx.updateData(current)
  }
  return 1
})

// --- unFirstArgumentEnhanced (deprecated, 仍需类型正确) ---
useAsyncData(
  (content?: string) => {
    const enhanced = unFirstArgumentEnhanced(content, 'default')
    return enhanced.firstArgument ?? 'default'
  },
  { enhanceFirstArgument: true }
)
