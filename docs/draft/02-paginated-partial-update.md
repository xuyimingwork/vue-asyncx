## 场景

useAsyncData 的 function 应该只关注完整 data
那么在 loadMore 场景，存在 gap：接口是分页的、展示是完整的
const { list } = useAsyncData('list', () => {
  
})
初始场景，现在列表[]，需要获得[1]列表 => 拉取第1页
比如上下拉动的场景，当前列表 [3]：
上拉，需要 [2, 3] 列表 => 拉取第2页
下拉，需要 [3, 4] 列表 => 拉取第4页
那么在上拉未结束时，触发下拉事件，上拉的内容理应被取消，除非继承未完成动作

本质是完整更新与部分更新的需求错位：useAsyncData('', patchUpdate)
如何设计 API，满足需要全局数据，但是局部异步更新场景？

## 草案

```ts
useAsyncAssemble(
  // 整体数据名称
  name: string, 
  // **部分**数据的获取方法
  fn: (...args: any) => any, 
  options: {
    // 从**部分**数据组装出整体数据
    assemble: () => any
  }

): {
  // 整体数据
  [`${name}`]: any
  // 暴露给外部用于获取部分数据
  [`gather${name}`]:  (...args: any) => any, 
}
```

## 这个模型能处理 useInfiniteQuery 的场景吗？

`useInfiniteQuery` 是 `useAsyncAssemble` 的一个特例。

`useAsyncAssemble` 面对的是：

- 用户需要一个异步数据
- 该异步数据需要多次异步获取操作
- 每次异步获取操作仅能获取部分数据
- 每次获取数据成功后更新整体数据

本质还是分组请求的问题，是“并行、同源、同语义”的特殊场景，可以通过 `withAddonGroup` + `useAsyncData` 搭建实现骨架

## 如何处理 loading

- `loading` 指什么？最新的 gather 动作？还是只要有 gather 就算？
  - 指最新的 gather 情况  
  - 需要提供全局是否有 gather 的动作吗？

## hasMore 是否属于 gather 的数据？

考虑数据变化场景：

{ total: 0, list: [], hasMore: unknown } => page1 [] => { total: 0, list: [], hasMore: false }

pageIndex 等内容是外部数据？hasMore 也是外部数据

hasMore 属于外部数据还是内部数据？

再简单一点
- 数据 -》 gather -》 assemble -》 数据

## 新的 API 提议

```ts
useAsyncMerged(
  // 整体数据名称
  name: string, 
  // **部分**数据的获取方法
  fn: (...args: any) => any, 
  options: {
    // 从**部分**数据组装出整体数据
    merge: () => any
  }

): {
  // 整体数据
  [`${name}`]: any
  // 暴露给外部用于获取部分数据
  [`gather${name}`]:  (...args: any) => any, 
}
```

新增辅助函数 `withMeta`（名称待定），用于在整体数据外提供额外数据

比如，如果 `initialData` 通过 `initialData: withMeta({ /* data */ }, { /* meta */ })` 设定时，后者进入 `meta` 部分。

- gather 方法可以返回 withMeta？
- merge 也可以返回 withMeta？
- gather 中获取 meta 数据？还要提供 getMeta，还有对应 updateMeta 方法？
  - context 机制需要更新？由 useAsyncXxxx 提供，插件仅在 context 上注册方法（怎么解决冲突问题？）
  - 如果不解决，getAsyncDataContext + getAsyncMergedContext ？
    - 同时调用：getAsyncMergedContext + getAsyncDataContext？=> 天呐
  - 通用的 getAsyncContext 方法？

考虑使用场景
```ts
const {} = useAsyncMerged('userList', () => {
  const { getMeta, updateMeta, getData, updateData } = getAsyncContext()
  const { pageSize, pageIndex, hasMore } = getMeta()
  if (!hasMore) return []
  // 更新全量数据 or 更新增量数据？
  // 单次更新可能存在片段外内容
  return api.queryUserPage()
    .then((res) => {
      return withMeta(
        []
      )
    })
})
```

如果外部没有传入额外内容，又没有对 meta 进行修改，那么一定只有一种既定模式。


