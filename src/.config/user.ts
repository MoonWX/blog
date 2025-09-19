import type { UserConfig } from '~/types'

export const userConfig: Partial<UserConfig> = {
  site: {
    title: '代码和远方',
    subtitle: 'MoonWX',
    tabtitle: 'MoonWX\'s Blog',
    author: 'MoonWX',
    description: 'Code and Alive',
    website: 'https://blog.moonwx.net/',
    pageSize: 5,
    socialLinks: [
      {
        name: 'home',
        href: 'https://moonwx.net',
      },
      {
        name: 'rss',
        href: '/atom.xml',
      },
    ],
    navLinks: [
      {
        name: 'Posts',
        href: '/',
      },
      {
        name: 'Archive',
        href: '/archive',
      },
      {
        name: 'Categories',
        href: '/categories',
      },
      {
        name: 'About',
        href: '/about',
      },
    ],
    categoryMap: [{ name: '', path: '' }],
    footer: [
      '© 2022 - %year <a target="_blank" href="%website">%author</a>',
      'Licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.',
      'Theme <a target="_blank" href="https://github.com/Moeyua/astro-theme-typography">Typography</a> by <a target="_blank" href="https://moeyua.com">Moeyua</a>',
      'Published with <a target="_blank" href="https://astro.build/">Astro</a>',
    ],
  },
  appearance: {
    theme: 'system',
    locale: 'zh-cn',
    colorsLight: {
      primary: '#2e405b',
      background: '#ffffff',
    },
    colorsDark: {
      primary: '#FFFFFF',
      background: '#232222',
    },
    fonts: {
      header:
        '"HiraMinProN-W6","Source Han Serif CN","Source Han Serif SC","Source Han Serif TC",serif',
      ui: '"Source Sans Pro","Roboto","Helvetica","Helvetica Neue","Source Han Sans SC","Source Han Sans TC","PingFang SC","PingFang HK","PingFang TC",sans-serif',
    },
  },
  seo: {
    twitter: '',
    meta: [],
    link: [],
  },
  rss: {
    fullText: true,
  },
  comment: {
    // disqus: { shortname: "typography-astro" },
  },
  analytics: {
    googleAnalyticsId: '',
    umamiAnalyticsId: '',
  },
  latex: {
    katex: false,
  },
}
