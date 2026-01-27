import { getUserApi } from "demo/api";
import { ref } from "vue";

const user = ref()
const queryUserLoading = ref(false)

// 用于追踪最新请求的ID
let requestId = 0

function queryUser(name: string) {
  queryUserLoading.value = true
  
  // 每次调用时递增请求ID
  const currentRequestId = ++requestId
  
  return getUserApi(name)
    .then(data => {
      // 只有当前请求是最新的请求时，才更新数据
      if (currentRequestId === requestId) {
        user.value = data
      }
      return data
    })
    .finally(() => {
      // 只有当前请求是最新的请求时，才更新loading状态
      if (currentRequestId === requestId) {
        queryUserLoading.value = false
      }
    })
}

// 竞态场景：快速连续调用两次
// 第一个请求较慢，第二个请求较快
// 如果没有竞态控制，第一个请求的结果可能会覆盖第二个请求的结果
queryUser('user1')  // 调用 A => 较慢，后结束
queryUser('user2')  // 调用 B => 较快，先结束（最后发起的调用）

