import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import vue from '@vitejs/plugin-vue'
import { githubPagesTarget } from './utils/deployment.js'

export default defineConfig(({ mode }) => {
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
  return {
    base: mode === 'pages' ? pages.base : '/',
    resolve: { alias: { '~': fileURLToPath(new URL('.', import.meta.url)) } },
    plugins: [vue()],
  }
})
