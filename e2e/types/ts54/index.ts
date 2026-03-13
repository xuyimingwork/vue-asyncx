import { useAsync, useAsyncData, withAddonGroup } from 'vue-asyncx'

const method = useAsync('submit', async () => true, {
  addons: [
    withAddonGroup({
      key: () => 'fixed',
    })
  ]
})

const data = useAsyncData('user', async () => ({ name: 'Mike' }), {
  addons: [
    withAddonGroup({
      key: () => 'fixed'
    })
  ]
})