import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import vue from '@vitejs/plugin-vue'
import { githubPagesTarget } from './utils/deployment.js'
import { metadataHead } from './utils/metadata.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let pages
  try {
    const remote = process.env.GITHUB_REPOSITORY
      ? `https://github.com/${process.env.GITHUB_REPOSITORY}`
      : execFileSync('git', ['config', '--get', 'remote.origin.url'], { encoding: 'utf8' })
    pages = githubPagesTarget(remote)
  } catch {
    // Local development can run without a Git remote.
  }
  if (mode === 'pages' && !pages) {
    throw new Error('GitHub Pages 빌드에는 GitHub origin 원격 저장소가 필요합니다.')
  }
  const siteUrl = env.SITE_URL || (mode === 'pages' ? pages.url : '')
  return {
    base: mode === 'pages' ? pages.base : '/',
    define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl) },
    resolve: { alias: { '~': fileURLToPath(new URL('.', import.meta.url)) } },
    plugins: [
      vue(),
      {
        name: 'flight-shade-metadata',
        transformIndexHtml(html) {
          return html.replace(
            '<!--app-meta-->',
            `<!--app-meta-start-->\n${metadataHead('ko', siteUrl)}\n<!--app-meta-end-->`,
          )
        },
      },
    ],
  }
})
