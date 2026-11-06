import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { I18N_MESSAGES } from '../i18n/index.js'

const read = (path) => readFile(`dist/${path}`, 'utf8')
const korean = await read('index.html')
const canonical = korean.match(/rel="canonical" href="([^"]+)"/)?.[1]
const base = canonical ? new URL(canonical).pathname : '/'
const initialScripts = new Set()

for (const language of ['ko', 'en']) {
  const html = language === 'en' ? await read('en/index.html') : korean
  assert.ok(html.includes(`<html lang="${language}">`), `${language}: document language`)
  assert.ok(html.includes(I18N_MESSAGES[language].routeSettings), `${language}: prerendered form`)
  assert.ok(
    html.includes(I18N_MESSAGES[language].guideAccuracyAnswer),
    `${language}: actual method description`,
  )
  assert.ok(!html.includes('<!--app-html-->'), `${language}: prerender completed`)
  assert.ok(
    html.includes(`<title>${I18N_MESSAGES[language].pageTitle.replaceAll('&', '&amp;')}</title>`),
    `${language}: translated title`,
  )
  const schema = JSON.parse(html.match(/id="app-schema">([\s\S]*?)<\/script>/)?.[1] || 'null')
  assert.equal(schema?.['@type'], 'WebApplication')
  assert.deepEqual(schema.inLanguage, ['ko', 'en'])
  if (canonical) {
    const expected = `${canonical}${language === 'en' ? 'en/' : ''}`
    assert.ok(html.includes(`rel="canonical" href="${expected}"`))
    assert.ok(html.includes(`hreflang="ko" href="${canonical}"`))
    assert.ok(html.includes(`hreflang="en" href="${canonical}en/"`))
    assert.equal(schema.url, expected)
  }
  const assets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"?]+)"/g)].map(
    (match) => match[1],
  )
  assert.ok(assets.length >= 2, `${language}: JS and CSS references`)
  for (const asset of assets) {
    assert.ok(asset.startsWith(base), `${language}: asset retains deployment base`)
    const path = asset.slice(base.length)
    assert.ok((await stat(`dist/${path}`)).size > 0, `${language}: ${path} exists`)
    if (path.endsWith('.js')) initialScripts.add(path)
  }
}

let initialBytes = 0
for (const script of initialScripts) initialBytes += (await stat(`dist/${script}`)).size
assert.ok(initialBytes < 250000, 'Initial JavaScript stays below the 250 kB budget')
if (canonical) {
  const sitemap = await read('sitemap.xml')
  for (const url of [canonical, `${canonical}en/`]) assert.ok(sitemap.includes(`<loc>${url}</loc>`))
  assert.ok((await read('robots.txt')).includes(`Sitemap: ${canonical}sitemap.xml`))
}
assert.ok((await read('llms.txt')).includes('Weather, actual air traffic routing'))
console.log(
  `Verified Korean and English HTML, structured data, deployment paths and initial JS (${(initialBytes / 1000).toFixed(1)} kB).`,
)
