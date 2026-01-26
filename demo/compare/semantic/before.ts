import { useAsyncState } from '@vueuse/core'
import { getOrderApi, getUserApi } from '../../api'

const { 
  state: user, 
  isLoading: queryUserLoading,
  execute: queryUser 
} = useAsyncState(getUserApi, undefined)

const { 
  state: order, 
  isLoading: queryOrderLoading,
  execute: queryOrder 
} = useAsyncState(getOrderApi, undefined)

queryUser('Mike')
queryOrder('12345')
