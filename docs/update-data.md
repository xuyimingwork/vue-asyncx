# 如何在 useAsyncData 的过程中获取并更新 data 值？

## 方案1 通过类似 AbortController 机制

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







