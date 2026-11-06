import test from 'node:test'
import assert from 'node:assert/strict'
import { githubPagesTarget } from '../utils/deployment.js'

test('GitHub project Pages retains the repository subpath', () => {
  assert.deepEqual(githubPagesTarget('https://github.com/yheun03/flight-shade.git'), {
    base: '/flight-shade/',
    url: 'https://yheun03.github.io/flight-shade/',
  })
  assert.equal(githubPagesTarget('git@github.com:yheun03/renamed-repo.git').base, '/renamed-repo/')
})

test('GitHub account Pages uses the root path and non-GitHub remotes are rejected', () => {
  assert.equal(githubPagesTarget('https://github.com/yheun03/yheun03.github.io.git').base, '/')
  assert.equal(githubPagesTarget('https://example.com/user/repo.git'), null)
})
