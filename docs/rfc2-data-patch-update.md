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
如何设计 API，满足异步部分更新场景？

```ts
useAsyncAssembler(
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
