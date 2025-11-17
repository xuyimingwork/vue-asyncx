import { getUserApi } from './api'
import { useAsyncData } from '../dist/vue-asyncx'

const { 
  user, 
  queryUserLoading 
} = useAsyncData('user', getUserApi, { immediate: true })

