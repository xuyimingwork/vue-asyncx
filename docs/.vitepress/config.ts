import { defineConfig } from 'vitepress'

export default defineConfig({
  srcDir: '../',

  lang: 'zh-CN',
  title: 'Vue Asyncx',
  description: '让异步像写诗的 Vue 3 / Vue 2.7 组合式工具',
  
  themeConfig: {
    nav: [
      { text: '指南', link: '/introduction' },
      { text: '在线演示', link: 'https://www.typescriptlang.org/play/?ts=5.9.3#code/PQKhCgAIUg3BXApgWgIYGcCeA7AxgD0kH95QCldAuT0Gj5QCH-A5uUADvQVWVAGJUFhNQIXNBIf6hgBVMAHRAGVcAJwCW-AC6QACgBtUmAOaiA9vGwATQFj-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' },
    ],
    
    sidebar: {
      '/': [
        {
          text: '开始',
          items: [
            { text: '简介', link: '/introduction' },
            { text: '快速上手', link: '/quick-start' },
          ]
        },
        {
          text: '组合式函数',
          items: [
            { text: 'useAsync 使用异步函数', link: '/hooks/use-async' },
            { text: 'useAsyncData 使用异步数据', link: '/hooks/use-async-data' },
          ]
        },
        {
          text: '插件',
          items: [
            { text: 'withAddonGroup 调用分组', link: '/addons/group' },
          ]
        },
      ]
    },
    
    socialLinks: [
      { icon: 'github', link: 'https://github.com/xuyimingwork/vue-asyncx' }
    ],
    
    search: {
      provider: 'local'
    },
    
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Xu Yiming'
    },
  },

  rewrites: {
    'docs/index.md': 'index.md',
    'docs/introduction.md': 'introduction.md',
    'docs/quick-start.md': 'quick-start.md',
    // hooks
    'src/hooks/use-async/usage.md': 'hooks/use-async.md',
    'src/hooks/use-async-data/usage.md': 'hooks/use-async-data.md',
    // addons
    'src/addons/group/usage.md': 'addons/group.md',
  },

  vite: {
    // 忽略根路径下的配置文件
    configFile: false
  }
})
