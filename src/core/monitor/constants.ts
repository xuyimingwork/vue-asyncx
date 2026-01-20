/**
 * @fileoverview Monitor 常量定义
 * 
 * @module core/monitor/constants
 */

/**
 * 核心状态公共 key：供其他 addon 读取状态
 */
export const RUN_ARGUMENTS: symbol = Symbol('vue-asyncx:run:arguments')
export const RUN_ERROR: symbol = Symbol('vue-asyncx:run:error')
export const RUN_LOADING: symbol = Symbol('vue-asyncx:run:loading')
export const RUN_DATA: symbol = Symbol('vue-asyncx:run:data')
export const RUN_DATA_UPDATED: symbol = Symbol('vue-asyncx:run:data-updated')
