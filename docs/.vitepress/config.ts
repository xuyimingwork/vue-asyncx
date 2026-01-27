import { defineConfig } from 'vitepress'

export default defineConfig({
  srcDir: '../',

  base: '/vue-asyncx/',
  lang: 'zh-CN',
  title: 'Vue Asyncx',
  description: '让异步像写诗的 Vue 3 组合式工具',
  
  themeConfig: {
    nav: [
      { text: '指南', link: '/introduction' },
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
