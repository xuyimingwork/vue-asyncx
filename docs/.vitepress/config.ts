import { defineConfig } from 'vitepress'

export default defineConfig({
  srcDir: '../',
  srcExclude: ['**/README.md'],

  base: '/vue-asyncx/',
  lang: 'zh-CN',
  title: 'Vue Asyncx',
  description: '让异步像写诗的 Vue 3 组合式工具',
  
  themeConfig: {
    nav: [
      { text: '指南', link: '/' },
    ],
    
    sidebar: {
      '/': [
        {
          text: '开始',
          items: [
            { text: '简介' },
            { text: '快速上手' },
          ]
        },
        {
          text: '组合式函数',
          items: [
            { text: 'useAsync 使用异步函数', link: '/hooks/use-async.html' },
            { text: 'useAsyncData 使用异步数据', link: '/hooks/use-async-data.html' },
          ]
        },
        {
          text: '插件',
          items: [
            { text: 'withAddonGroup 调用分组' },
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
    'src/hooks/:hook/usage.md': 'hooks/:hook.html'
  }
})
