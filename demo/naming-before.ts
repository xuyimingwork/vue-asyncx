import { useAsyncState } from "@vueuse/core";
import { confirmApi, getOptionsApi, getOrderListApi } from "demo/api";

// 开发者A：完全重命名，使用语义化的变量名
const {
  state: orderList,
  isLoading: queryOrderListLoading,
  error: queryOrderListError,
  execute: queryOrderList
} = useAsyncState(getOrderListApi, undefined)

// 开发者B：部分重命名，保留部分原始名称
const {
  state,
  isLoading: optionsLoading,
  error: optionsError,
  execute: fetchOptions  // 使用不同的函数命名风格
} = useAsyncState(getOptionsApi, undefined)

// 开发者C：不进行重命名，直接使用原始属性名
const {
  isLoading,
  error,
  execute
} = useAsyncState(
  async (id: number) => {
    const result = await confirmApi(id)
    // 确认成功后刷新列表
    queryOrderList(undefined, 'order')
    return result
  },
  undefined
)

// 初始化加载
queryOrderList(undefined, 'order')
fetchOptions(undefined, 'filter')

// 确认操作
execute(undefined, 1)
