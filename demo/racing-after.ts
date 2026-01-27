import { getUserApi } from "demo/api";
import { useAsyncData } from "dist/vue-asyncx";

const {
  user,
  queryUser,
  queryUserLoading
} = useAsyncData('user', getUserApi)

// 竞态场景：快速连续调用两次
// 第一个请求较慢，第二个请求较快
// 如果没有竞态控制，第一个请求的结果可能会覆盖第二个请求的结果
queryUser('user1')  // 调用 A => 较慢，后结束
queryUser('user2')  // 调用 B => 较快，先结束（最后发起的调用）