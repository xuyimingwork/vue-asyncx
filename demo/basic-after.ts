import { getUserApi } from "demo/api";
import { useAsyncData } from "dist/vue-asyncx";

const {
  user,
  queryUser,
  queryUserLoading
} = useAsyncData('user', getUserApi)

queryUser('Mike')