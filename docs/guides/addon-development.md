# Addon 开发指南

本文档介绍如何为 Vue-AsyncX 开发自定义 Addon（插件）。

## 一、Addon 系统概述

### 什么是 Addon

Addon 是 Vue-AsyncX 的插件系统，用于扩展 `useAsync` 和 `useAsyncData` 的功能。通过 Addon，你可以：

- 添加新的状态管理（如重试次数、缓存状态等）
- 监听函数执行的生命周期事件
- 在函数执行前后执行自定义逻辑
- 访问最终的包装函数（method）

### Addon 的作用

Addon 系统使得 Vue-AsyncX 具有高度的可扩展性：

- **功能模块化**：每个功能都是独立的 Addon，可以按需使用
- **类型安全**：完整的 TypeScript 类型支持
- **组合灵活**：可以组合多个 Addon 实现复杂功能
- **命名统一**：自动应用命名约定，保持一致性

### 内置 Addon 示例

Vue-AsyncX 提供了多个内置 Addon：

- `withAddonLoading`：管理加载状态
- `withAddonError`：管理错误状态
- `withAddonArguments`：追踪函数参数
- `withAddonData`：管理数据状态
- `withAddonFunction`：返回包装后的函数
- `withAddonWatch`：自动监听并执行

## 二、Addon 类型

### 基础 Addon（返回对象）

基础 Addon 直接返回一个对象，包含要添加的状态。这些状态会在阶段一（setup 前）被收集和合并。

**特点**：
- 仅参与阶段一执行
- 可以监听函数执行事件
- 不能访问最终的 method

**示例**：
```typescript
function withAddonLoading(): (params: { 
  monitor: FunctionMonitor
}) => {
  __name__Loading: Ref<boolean>
} {
  return (({ monitor }) => {
    const loading = ref(false)

    monitor.on('before', () => {
      loading.value = true
    })

    monitor.on('fulfill', ({ track }) => {
      if (!track.isLatest()) return
      loading.value = false
    })

    monitor.on('reject', ({ track }) => {
      if (!track.isLatest()) return
      loading.value = false
    })

    return {
      __name__Loading: loading,
    }
  }) as any
}
```

### 高级 Addon（返回函数）

高级 Addon 返回一个函数，该函数会在阶段二（setup 后）执行，可以访问最终的 method。

**特点**：
- 参与阶段一和阶段二执行
- 阶段一：可以监听事件，准备状态
- 阶段二：可以访问最终的 method，执行额外逻辑

**示例**：
```typescript
function withAddonWatch(options?: any): <T extends AddonTypes>(params: { 
  _types: T
}) => ({ method }: { method: T['Method'] }) => void {
  return (() => {
    return ({ method }) => {
      // 阶段二：可以访问最终的 method
      useWatch(method, options)
    }
  }) as any
}
```

### 两阶段执行机制

Addon 的执行分为两个阶段：

1. **阶段一（setup 前）**：
   - 所有 Addon 都会执行
   - 基础 Addon 返回对象，立即合并
   - 高级 Addon 返回函数，保存待执行

2. **阶段二（setup 后）**：
   - 只有高级 Addon 会执行
   - 可以访问最终的 method
   - 返回的状态会与阶段一的状态合并

## 三、开发步骤

### 步骤 1：创建 Addon 函数

创建一个函数，返回 Addon 实现：

```typescript
import type { FunctionMonitor } from "@/core/monitor"
import { Ref, ref } from "vue"

export function withAddonCustom(): (params: { 
  monitor: FunctionMonitor
}) => {
  __name__Custom: Ref<string>
} {
  // Addon 实现
}
```

### 步骤 2：使用 Monitor API

在 Addon 中使用 `monitor` 监听函数执行事件：

```typescript
return (({ monitor }) => {
  // 监听事件
  monitor.on('before', ({ args, track }) => {
    // 处理逻辑
  })
  
  monitor.on('fulfill', ({ track, value }) => {
    // 处理逻辑
  })
  
  // 返回状态
  return {
    __name__Custom: ref('initial')
  }
}) as any
```

### 步骤 3：返回状态对象

返回包含状态的对象，使用 `__name__` 占位符：

```typescript
return {
  __name__Custom: ref('value'),
  __name__CustomStatus: ref('idle')
}
```

### 步骤 4：命名约定

使用 `__name__` 占位符，系统会自动替换为实际名称：

- `__name__` 在开头：替换为小驼峰（如 `__name__Loading` → `userLoading`）
- `__name__` 在中间：替换为大驼峰（如 `query__name__` → `queryUser`）
- 不包含 `__name__` 的属性：默认丢弃

## 四、API 参考

### FunctionMonitor API

#### 事件监听

```typescript
monitor.on('init', ({ args, track }) => {
  // 函数调用初始化
})

monitor.on('before', ({ args, track }) => {
  // 函数执行前
})

monitor.on('after', ({ track }) => {
  // 函数执行后（同步部分完成）
})

monitor.on('fulfill', ({ track, value }) => {
  // 函数成功完成
})

monitor.on('reject', ({ track, error }) => {
  // 函数执行失败
})
```

#### 移除监听

```typescript
const handler = ({ args, track }) => {
  // 处理逻辑
}

monitor.on('before', handler)
monitor.off('before', handler)
```

### Track API

**注意**：在 Addon 中使用的 `Track` 类型是受限的，不包含状态修改方法（`fulfill()` 和 `reject()`）。这些方法仅在内部使用，外部 Addon 无法修改调用状态。

#### 状态检查

```typescript
track.is('pending')      // 检查是否处于 pending 状态
track.is('fulfilled')    // 检查是否处于 fulfilled 状态
track.is('rejected')     // 检查是否处于 rejected 状态
track.is('finished')     // 检查是否已完成（fulfilled 或 rejected）
track.is()               // 无参数时返回当前状态
```

#### 竟态判断

```typescript
track.isLatest()                    // 是否为最新的 pending 调用
track.isLatest('pending')           // 是否为最新的 pending 调用
track.isLatest('fulfilled')         // 是否为最新的 fulfilled 调用
track.isLatest('rejected')          // 是否为最新的 rejected 调用

track.hasLater('pending')           // 是否有后续的 pending 调用
track.hasLater('fulfilled')        // 是否有后续的 fulfilled 调用
track.hasLater('rejected')         // 是否有后续的 rejected 调用
track.hasLater('finished')         // 是否有后续的 finished 调用
```

#### 数据存储

```typescript
const KEY = Symbol('key')

track.setData(KEY, value)  // 存储数据
track.getData(KEY)         // 获取数据
track.takeData(KEY)        // 获取并移除数据
```

### 事件类型说明

#### init 事件

**触发时机**：函数调用初始化，用于准备上下文。

**数据**：
```typescript
{
  args: any[],      // 函数参数
  track: Track      // 调用追踪对象
}
```

#### before 事件

**触发时机**：函数执行前，用于观察逻辑。

**数据**：
```typescript
{
  args: any[],      // 函数参数
  track: Track      // 调用追踪对象
}
```

#### after 事件

**触发时机**：函数执行后（同步部分完成），在 fulfill/reject 之前。

**数据**：
```typescript
{
  track: Track      // 调用追踪对象
}
```

#### fulfill 事件

**触发时机**：函数成功完成。

**数据**：
```typescript
{
  track: Track,     // 调用追踪对象
  value: any       // 函数返回值
}
```

#### reject 事件

**触发时机**：函数执行失败。

**数据**：
```typescript
{
  track: Track,     // 调用追踪对象
  error: any       // 错误信息
}
```

## 五、最佳实践

### 状态管理

1. **使用响应式引用**：使用 `ref` 或 `computed` 创建响应式状态
2. **竟态处理**：使用 `track.isLatest()` 确保只更新最新调用的状态
3. **状态清理**：在适当的时候清理状态（如新调用开始时）

**示例**：
```typescript
monitor.on('before', () => {
  // 新调用开始，清理之前的状态
  customState.value = 'idle'
})

monitor.on('fulfill', ({ track }) => {
  // 只有最新调用才更新状态
  if (!track.isLatest()) return
  customState.value = 'success'
})
```

### 竟态处理

始终检查是否为最新调用，避免旧调用的状态覆盖新调用：

```typescript
monitor.on('fulfill', ({ track, value }) => {
  // 只有最新调用才更新
  if (!track.isLatest()) return
  data.value = value
})
```

### 性能优化

1. **按需监听**：只监听需要的事件
2. **及时清理**：在不需要时移除事件监听器
3. **避免重复计算**：使用 `computed` 缓存计算结果

### 类型安全

1. **使用泛型**：为 Addon 添加泛型支持
2. **类型推导**：利用 TypeScript 的类型推导
3. **类型约束**：使用类型约束确保类型安全

**示例**：
```typescript
export function withAddonCustom<T = any>(): (params: { 
  monitor: FunctionMonitor
}) => {
  __name__Custom: Ref<T>
} {
  return (({ monitor }) => {
    const custom = ref<T>()
    // ...
    return {
      __name__Custom: custom
    }
  }) as any
}
```

## 六、示例

### 简单 Addon 示例：重试次数

```typescript
import type { FunctionMonitor } from "@/core/monitor"
import { Ref, ref } from "vue"

export function withAddonRetryCount(): (params: { 
  monitor: FunctionMonitor
}) => {
  __name__RetryCount: Ref<number>
} {
  return (({ monitor }) => {
    const retryCount = ref(0)

    monitor.on('before', () => {
      retryCount.value = 0
    })

    monitor.on('reject', ({ track }) => {
      if (!track.isLatest()) return
      retryCount.value++
    })

    return {
      __name__RetryCount: retryCount,
    }
  }) as any
}
```

**使用**：
```typescript
const { queryUser, queryUserRetryCount } = useAsync('user', fetchUser, {
  addons: [withAddonRetryCount()]
})

queryUser()
// queryUserRetryCount.value 会显示重试次数
```

### 复杂 Addon 示例：缓存管理

```typescript
import type { FunctionMonitor } from "@/core/monitor"
import { Ref, ref, computed } from "vue"

export function withAddonCache<T = any>(ttl: number = 5000): <T extends AddonTypes>(params: { 
  _types: T
}) => ({ method }: { method: T['Method'] }) => {
  __name__Cache: Ref<T | undefined>
  __name__CacheExpired: Ref<boolean>
} {
  const cache = new Map<string, { value: any, timestamp: number }>()
  
  return (() => {
    return ({ method }) => {
      const cacheData = ref<T | undefined>()
      const cacheExpired = ref(false)
      
      // 包装 method，添加缓存逻辑
      const cachedMethod = ((...args: any[]) => {
        const key = JSON.stringify(args)
        const cached = cache.get(key)
        
        // 检查缓存是否有效
        if (cached && Date.now() - cached.timestamp < ttl) {
          cacheData.value = cached.value
          cacheExpired.value = false
          return Promise.resolve(cached.value)
        }
        
        // 调用原方法
        const result = method(...args)
        
        // 缓存结果
        if (result instanceof Promise) {
          return result.then(value => {
            cache.set(key, { value, timestamp: Date.now() })
            cacheData.value = value
            cacheExpired.value = false
            return value
          })
        } else {
          cache.set(key, { value: result, timestamp: Date.now() })
          cacheData.value = result
          cacheExpired.value = false
          return result
        }
      }) as any
      
      return {
        __name__Cache: cacheData,
        __name__CacheExpired: cacheExpired,
        __name__: cachedMethod  // 替换原 method
      }
    }
  }) as any
}
```

### 实际应用场景

#### 场景 1：请求去重

```typescript
function withAddonDedupe(): (params: { 
  monitor: FunctionMonitor
}) => {
  __name__Pending: Ref<boolean>
} {
  const pendingCalls = new Set<string>()
  
  return (({ monitor }) => {
    const pending = ref(false)
    
    monitor.on('before', ({ args }) => {
      const key = JSON.stringify(args)
      if (pendingCalls.has(key)) {
        pending.value = true
      } else {
        pendingCalls.add(key)
      }
    })
    
    monitor.on('after', ({ args }) => {
      const key = JSON.stringify(args)
      pendingCalls.delete(key)
      pending.value = false
    })
    
    return {
      __name__Pending: pending
    }
  }) as any
}
```

#### 场景 2：自动重试

```typescript
function withAddonRetry(maxRetries: number = 3): <T extends AddonTypes>(params: { 
  _types: T
}) => ({ method }: { method: T['Method'] }) => T['Method'] {
  return (() => {
    return ({ method }) => {
      const retryMethod = (async (...args: any[]) => {
        let lastError: any
        for (let i = 0; i <= maxRetries; i++) {
          try {
            return await method(...args)
          } catch (error) {
            lastError = error
            if (i === maxRetries) throw error
          }
        }
      }) as any
      
      return {
        __name__: retryMethod
      }
    }
  }) as any
}
```

## 七、测试 Addon

### 如何测试 Addon

1. **创建测试文件**：在 `__test__` 目录创建测试文件
2. **模拟 Monitor**：创建模拟的 Monitor 实例
3. **测试状态更新**：验证状态是否正确更新
4. **测试事件处理**：验证事件处理逻辑

**示例**：
```typescript
import { describe, it, expect, vi } from 'vitest'
import { withAddonCustom } from '../custom'
import { createFunctionMonitor } from '@/core/monitor'

describe('withAddonCustom', () => {
  it('should add custom state', () => {
    const monitor = createFunctionMonitor()
    const addon = withAddonCustom()
    const result = addon({ monitor, _types: undefined })
    
    expect(result).toHaveProperty('__name__Custom')
  })
  
  it('should update state on event', () => {
    const monitor = createFunctionMonitor()
    const addon = withAddonCustom()
    const result = addon({ monitor, _types: undefined })
    
    monitor.emit('before', { args: [], track: {} as any })
    // 验证状态更新
  })
})
```

### 测试工具和技巧

1. **使用 Vitest**：项目使用 Vitest 作为测试框架
2. **模拟依赖**：使用 `vi.fn()` 模拟函数
3. **测试竟态条件**：创建多个调用，测试竟态处理
4. **测试类型**：使用类型测试确保类型正确

---

**文档版本**：1.0  
**最后更新**：2026年

