import { getUserApi } from '../../api'
import { ref } from 'vue'

const user = ref<string>()
const queryUserLoading = ref(false)
const queryUserError = ref<Error | undefined>()

let requestId = 0

function queryUser(name: string) {
  const currentRequestId = ++requestId
  queryUserLoading.value = true
  queryUserError.value = undefined
  
  return getUserApi(name)
    .then(data => {
      if (currentRequestId === requestId) {
        user.value = data
      }
    })
    .catch(error => {
      if (currentRequestId === requestId) {
        queryUserError.value = error
      }
    })
    .finally(() => {
      if (currentRequestId === requestId) {
        queryUserLoading.value = false
      }
    })
}

queryUser('user1')
queryUser('user2')
