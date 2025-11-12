## 1.7.0
- useAsyncData 支持配置 shallow 使用 shallowRef

## 1.6.0
- useAsync 返回新增 methodArgumentFirst

## 1.5.4
- UseAsyncDataOptions 支持传入 initialData 参数用于初始化 data 值

## 1.5.3
- unFirstArgumentEnhanced 支持 defaultValue 参数

## 1.5.2 
- README 文件更新

## 1.5.1
- firstArgumentEnhanced 增加对 fn() 与 fn(undefined) 的区分
- README 更新

## 1.5.0
- useAsyncData 支持中途更新 data
  - 新增 options.enhanceFirstArgument 配置
  - 新增 unFirstArgumentEnhanced 函数，用于方便解构首个参数

## 1.4.0
- watchOptions 新增 handlerCreator 参数用于自定义 watch 的 handler 函数
  - handlerCreator 接收当前的 method 作为参数并返回 watch 的 handler
  - 通过自定义 handler，现在可以自定义 method 的调用时机

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