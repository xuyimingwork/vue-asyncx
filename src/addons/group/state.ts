import { defineStateArguments } from "@/addons/arguments"
import { defineStateData } from "@/addons/data/state"
import { defineStateError } from "@/addons/error"
import { defineStateLoading } from "@/addons/loading"
import type { Track } from "@/core/monitor"
import type { Ref } from "vue"
import { ref } from "vue"

/**
 * 内部 Group 类型
 */
export type Group = {
  loading: boolean
  error: any
  arguments: any
  argumentFirst: any
  data: any
  dataExpired: any
}

/**
 * 创建默认的 group 状态对象
 * 
 * @returns 默认状态对象
 */
function createDefaultGroupState(): Group {
  return {
    loading: false,
    error: undefined,
    arguments: undefined,
    argumentFirst: undefined,
    data: undefined,
    dataExpired: false
  }
}

/**
 * 创建并初始化一个 group 状态
 * 
 * @returns 返回 group ref 和 update 函数
 */
export function createGroupState(): {
  group: Ref<Group>
  update: (track: Track) => void
} {
  const group = ref(createDefaultGroupState())
  
  const { update: updateLoading } = defineStateLoading({
    set: (v) => group.value.loading = v
  })
  
  const {
    update: updateArguments,
    argumentFirst
  } = defineStateArguments({
    get: () => group.value.arguments,
    set: (v) => group.value.arguments = v
  })
  
  group.value.argumentFirst = argumentFirst
  
  const { update: updateError } = defineStateError({
    set: (v) => group.value.error = v
  })
  
  const {
    update: updateData,
    dataExpired
  } = defineStateData({
    set: (v) => group.value.data = v
  })
  
  group.value.dataExpired = dataExpired
  
  const update: (track: Track) => void = (track: Track) => {
    updateArguments(track)
    updateLoading(track)
    updateError(track)
    updateData(track)
  }
  
  return {
    group,
    update
  }
}
