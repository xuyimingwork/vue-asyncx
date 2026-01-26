import { getUserApi, getOrderApi } from '../../api'
import { useAsyncData } from '../../../dist/vue-asyncx'

const { 
  user, 
  queryUserLoading,
  queryUser 
} = useAsyncData('user', getUserApi)

const { 
  order, 
  queryOrderLoading,
  queryOrder 
} = useAsyncData('order', getOrderApi)

queryUser('Mike')
queryOrder('12345')
