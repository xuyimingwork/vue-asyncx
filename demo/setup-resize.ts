import { useAsyncData } from '../dist/vue-asyncx'
import { debounce } from "es-toolkit"
import { useEventListener, useIntervalFn } from '@vueuse/core'
import { getUserApi } from './api'

const { 
  user, 
  queryUser 
} = useAsyncData('user', getUserApi, {
  immediate: true,
  setup(fn) {
    useEventListener(document, 'visibilitychange', fn)
    useIntervalFn(fn as any, 1000)
    useEventListener('resize', debounce(fn, 500) as any)
  }
})