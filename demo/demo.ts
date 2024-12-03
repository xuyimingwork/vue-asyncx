import { unFirstArgumentEnhanced, useAsyncData } from '../dist/vue-asyncx'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const { 
  progress,
  queryProgress
} = useAsyncData('progress', async function () {
  const { getData, updateData } = unFirstArgumentEnhanced(arguments[0])
  updateData(0)
  await wait(100)
  updateData(50)
  await wait(100)
  return 100
}, { 
  enhanceFirstArgument: true
})

