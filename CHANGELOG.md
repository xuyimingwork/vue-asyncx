## 1.3.0
- useAsync 返回新增 methodError
  - 保存上一次调用的错误信息，新调用开始后重置
- useAsyncData 返回新增 dataExpired
  - 该字段标识 data 数据是否过期
  - 当 data 在上次调用结束后未能正常更新，则标注为过期
  - 注意：仅开始执行函数并不会导致数据过期，只有在函数执行完成后才开始过期判断
- 修复多次执行异步函数响应异常导致的数据不一致情况

## 1.2.0

- useAsync 返回新增 methodArguments
  - 保存调用方法时的入参信息，方法调用结束后重置置为 undefined

## 1.1.0

- 支持 watchOptions 参数
  - options 与 watchOptions 中都存在 immediate 时，以 watchOptions 中为准

## 1.0.4

- 更新 README
- 更新 keywords

## 1.0.3

- 移除 lodash-es 依赖
- 调整 vitest 依赖位置到开发依赖