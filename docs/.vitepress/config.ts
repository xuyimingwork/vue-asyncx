import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/vue-asyncx/',
  lang: 'zh-CN',
  title: 'Vue Asyncx',
  description: '让异步像写诗的 Vue 3 组合式工具',
  
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '快速开始', link: '/#快速开始' },
      { text: 'API 参考', link: '/api/hooks' },
      { text: '开发指南', link: '/guides/addon-development' },
    ],
    
    sidebar: {
      '/': [
        {
          text: '快速开始',
          items: [
            { text: '首页', link: '/' },
          ]
        },
        {
          text: 'API 参考',
          items: [
            { text: 'Hooks API', link: '/api/hooks' },
            { text: '核心 API', link: '/api/core' },
            { text: 'Addons API', link: '/api/addons' },
          ]
        },
        {
          text: '开发指南',
          items: [
            { text: 'Addon 开发指南', link: '/guides/addon-development' },
          ]
        },
        {
          text: '架构文档',
          items: [
            { text: '架构设计', link: '/architecture' },
            { text: '开发文档', link: '/development' },
            { text: '代码注释', link: '/code-comments' },
          ]
        },
        {
          text: 'RFC 文档',
          collapsed: true,
          items: [
            { text: 'RFC1: 异步数据更新', link: '/rfc1-async-data-update' },
            { text: 'RFC2: 数据补丁更新', link: '/rfc2-data-patch-update' },
            { text: 'RFC3: 设计 - 与 Addon Group', link: '/rfc3-design-with-addon-group' },
            { text: 'RFC3: Group 与 Addon', link: '/rfc3-group-with-addon' },
            { text: 'RFC3: 实现 - 与 Addon Group', link: '/rfc3-with-addon-group-implement' },
            { text: 'RFC4', link: '/rfc4' },
            { text: 'RFC5', link: '/rfc5' },
          ]
        },
      ],
      '/api/': [
        {
          text: 'API 参考',
          items: [
            { text: 'Hooks API', link: '/api/hooks' },
            { text: '核心 API', link: '/api/core' },
            { text: 'Addons API', link: '/api/addons' },
          ]
        }
      ],
      '/guides/': [
        {
          text: '开发指南',
          items: [
            { text: 'Addon 开发指南', link: '/guides/addon-development' },
          ]
        }
      ],
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
})
