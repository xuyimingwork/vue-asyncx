import { getUserApi } from '../../api'
import { ref } from 'vue'

const user = ref<string>()
const queryUserLoading = ref(false)
const queryUserError = ref<Error | undefined>()

function queryUser(name: string) {
  queryUserLoading.value = true
  queryUserError.value = undefined
  
  return getUserApi(name)
    .then(data => {
      user.value = data
    })
    .catch(error => {
      queryUserError.value = error
    })
    .finally(() => {
      queryUserLoading.value = false
    })
}

queryUser('Mike')
