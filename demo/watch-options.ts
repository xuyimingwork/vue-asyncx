import { getUserApi } from './api'
import { useAsyncData } from '../dist/vue-asyncx'

const props = defineProps<{
  userId: string;
}>();

const { user } = useAsyncData('user', () => getUserApi(props.userId), { 
  watch: () => props.userId,
  watchOptions: {
    once: true
  }
})
