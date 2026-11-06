import { build, createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { metadataHead, pageMetadata } from '../utils/metadata.js'

const mode = process.argv.includes('--pages') ? 'pages' : 'production'
await build({ mode })
const server = await createServer({
  mode,
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
})
try {
  const { default: App } = await server.ssrLoadModule('/app.vue')
  const template = await readFile('dist/index.html', 'utf8')
  const siteUrl = JSON.parse(server.config.define['import.meta.env.VITE_SITE_URL'])
  for (const language of ['ko', 'en']) {
    const appHtml = await renderToString(createSSRApp(App, { initialLanguage: language }))
    const document = template
      .replace('<html lang="ko">', `<html lang="${language}">`)
      .replace('<!--app-html-->', appHtml)
      .replace(
        /<!--app-meta-start-->[\s\S]*?<!--app-meta-end-->/,
        `<!--app-meta-start-->\n${metadataHead(language, siteUrl)}\n<!--app-meta-end-->`,
      )
      .replace(
        'JavaScript is required to calculate your flight. 항공편 계산에는 JavaScript가 필요합니다.',
        language === 'en'
          ? 'JavaScript is required to calculate your flight.'
          : '항공편 계산에는 JavaScript가 필요합니다.',
      )
    const directory = language === 'en' ? 'dist/en' : 'dist'
    await mkdir(directory, { recursive: true })
    await writeFile(`${directory}/index.html`, document)
    console.log(`Prerendered ${language}: ${directory}/index.html`)
  }
  const korean = pageMetadata('ko', siteUrl)
  const english = pageMetadata('en', siteUrl)
  const urls = [korean.canonical, english.canonical].filter(Boolean)
  const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  if (urls.length)
    await writeFile(
      'dist/sitemap.xml',
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escapeXml(url)}</loc></url>`).join('')}</urlset>`,
    )
  await writeFile(
    'dist/robots.txt',
    `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl.replace(/\/+$/, '')}/sitemap.xml\n` : ''}`,
  )
  await writeFile(
    'dist/llms.txt',
    `# Flight Shade\n\n> Choose a left or right airplane window seat for shade, sunshine, sunrise or sunset.\n\n## App\n${urls.map((url, index) => `- [${index ? 'English' : '한국어'}](${url})`).join('\n')}\n\n## How it works\n- Enter IATA airport codes, the departure airport's local date and time, and flight duration.\n- Select shade, sun, sunrise or sunset. Results update automatically.\n- Sunrise and sunset times use the departure airport's IANA time zone, including daylight saving time.\n- SunCalc solar positions are sampled along a great-circle route at an estimated altitude.\n- Sunrise and sunset seat recommendations use the sun's direction at that event. If there is no event, the app says so.\n- Weather, actual air traffic routing, aircraft attitude and window geometry are not included.\n- Shared query parameters: from, to, date, time, duration, preference.\n\n## Sources\n- [SunCalc 1.9.0](https://github.com/mourner/suncalc/tree/v1.9.0)\n- [Airport coordinates and time zones](https://github.com/mwgg/Airports)\n- [Project](https://github.com/yheun03/flight-shade)\n`,
  )
} finally {
  await server.close()
}
