# 如何在 useAsyncData fn 的执行过程中获取并更新 data 值？

## 方案1 通过类似 AbortController 的机制

- 不足1：需要在全局范围内暴露一个变量
- 不足2：无法控制 set、get 方法的失效时机（详细见方案2）

## 方案2 通过类似 handlerCreator 机制

将 fn 改造为支持传入工厂函数，传入 meta 信息

```js
const fnCreator = ({ get, set }) => {
  return fn(a: number, b: number) {
    return a + b
  }
}
```

考虑如下流程：

第一次调用 fn，记 fn1，在 fn1 未结束情况下，
第二次调用 fn，记 fn2

此时，fn1 调用 set 应该无效。
那么，在 set 内部，应该如何判断 set 是由 fn1 调用还是由 fn2 调用？

在这种场景下，get 和 set 想精细感知每次调用，需要传入调用 sn，对外暴露 sn 不是很好的方式

## 方案3 每次调用自动传入取值、设值方法

即：

```js
const fn = ({ get, set, value }, b) => {
  return value + b
}
```

`options` 增加 `enhanceFirstArgument: boolean` 配置，全局增加 `unFirstArgument` 工具函数

使用上调整为：

```js
const { 
  data, // => data.value 保持 fn 的解析类型
  queryData // => 保持 fn 的类型提示
} = useAsyncData((a: number, b: number) => {
  const { 
    firstArgument: _a, 
    getData, 
    setData 
  } = unFirstArgument(a)

  return _a + b
}, { enhanceFirstArgument: true })
```

再次考虑 api 设计：

- [x] `options.enhanceFirstArgument`
- [x] `unFirstArgument` 调整为 `unFirstArgumentEnhanced`
  - 明确作用是解析增强后的首个参数
  - 用户调用该方法解析非增强的首个参数时，抛出异常
- [x] 增强后的首个参数，提供 `firstArgument`、`getData`、`updateData` 三个内容
  - `firstArgument` 为可选属性，当原始传入 fn 的 args length 为 0 时，无该属性
    - 用户可以通过 undefined 与 in 操作判断原始传入数据情况
  - 从原本的 `get`、`set` 变更到 `getData` 与 `updateData`，考虑到：
    - `get`、`set` 的指向性更弱，且容易与 `lodash` 的方法冲突
    - 从 `setData` 到 `updateData`，主要考虑到 set 包含了 fn 执行结束返回设值的情况
      - 如果使用 set，就要考虑提供执行结束的 finish 调用
      - 如果提供了 finish 情形，就可能会出现 fn 还有很久才结束，但提前调用了 finish set
      - 则可能会出现 fn 的 data 更新与 loading 非常不一致的情况
      - 所以，先提供指向性更明确的 `updateData` 方式，finish set 还是通过 fn 的返回值来完成
    - `updateData` 会返回传入的 `v` 值，便于结束 fn 时通过 `return updateData('result')` 执行，方便用户统一更新 data 的方式。









