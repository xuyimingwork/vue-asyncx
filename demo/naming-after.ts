import { confirmApi, getOptionsApi, getOrderListApi } from "demo/api";
import { useAsync, useAsyncData } from "dist/vue-asyncx";

// 所有开发者都是相同的命名规范
const {
  orderList,
  queryOrderList,
  queryOrderListLoading,
  queryOrderListError
} = useAsyncData('orderList', getOrderListApi)

const {
  options,
  queryOptions,
  queryOptionsLoading,
  queryOptionsError
} = useAsyncData('options', getOptionsApi)

const {
  confirm,
  confirmLoading,
  confirmError
} = useAsync('confirm', async (id: number) => {
  const result = await confirmApi(id)
  // 确认成功后刷新列表
  queryOrderList('order')
  return result
})

// 初始化加载
queryOrderList('order')
queryOptions('filter')

// 确认操作
confirm(1)