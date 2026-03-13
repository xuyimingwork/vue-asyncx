import { useAsync, useAsyncData, withAddonGroup } from 'vue-asyncx'

const method: {
  submit: any,
  submitGroup: any
} = useAsync('submit', async () => true, {
  addons: [
    withAddonGroup({
      key: () => 'fixed',
    })
  ]
})

const data: {
  user: any
  userGroup: any
} = useAsyncData('user', async () => ({ name: 'Mike' }), {
  addons: [
    withAddonGroup({
      key: () => 'fixed'
    })
  ]
})