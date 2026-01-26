import { confirmApi } from '../../api'
import { reactive } from 'vue'

const confirmStates = reactive<Record<number, {
  loading: boolean
  error: Error | undefined
  data: string | undefined
}>>({})

const requestIds = reactive<Record<number, number>>({})

function confirm(id: number) {
  if (!confirmStates[id]) {
    confirmStates[id] = {
      loading: false,
      error: undefined,
      data: undefined
    }
    requestIds[id] = 0
  }
  
  const currentRequestId = ++requestIds[id]
  const state = confirmStates[id]
  state.loading = true
  state.error = undefined
  
  return confirmApi(id)
    .then(data => {
      if (currentRequestId === requestIds[id]) {
        state.data = data
      }
    })
    .catch(error => {
      if (currentRequestId === requestIds[id]) {
        state.error = error
      }
    })
    .finally(() => {
      if (currentRequestId === requestIds[id]) {
        state.loading = false
      }
    })
}
