import { getUserApi } from '../../api'
import { useAsyncData } from '../../../dist/vue-asyncx'

const { 
  user, 
  queryUserLoading,
  queryUserError,
  queryUser 
} = useAsyncData('user', getUserApi)

queryUser('user1')
queryUser('user2')
