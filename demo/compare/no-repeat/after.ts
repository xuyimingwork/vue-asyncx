import { getUserApi } from '../../api'
import { useAsyncData } from '../../../dist/vue-asyncx'

const { 
  user, 
  queryUserLoading,
  queryUserError,
  queryUser, 
} = useAsyncData('user', getUserApi)

queryUser('Mike')
