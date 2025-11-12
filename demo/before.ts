import { getUserApi } from "./api";
import { ref } from "vue";

const user = ref()
const queryUserLoading = ref(false)

function queryUser(name: string) {
  queryUserLoading.value = true
  return getUserApi(name)
    .then(data => user.value = data)
    .finally(() => queryUserLoading.value = false)
}

queryUser('Mike')