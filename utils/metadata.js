import { I18N_MESSAGES } from '../i18n/index.js'

export function pageMetadata(language, siteUrl = '') {
  const messages = I18N_MESSAGES[language]
  const base = siteUrl ? `${siteUrl.replace(/\/+$/, '')}/` : ''
  const canonical = base ? `${base}${language === 'en' ? 'en/' : ''}` : ''
  return {
    title: messages.pageTitle,
    description: messages.description,
    canonical,
    alternates: base ? { ko: base, en: `${base}en/`, 'x-default': base } : {},
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Flight Shade',
      applicationCategory: 'TravelApplication',
      operatingSystem: 'Any',
      description: messages.description,
      inLanguage: ['ko', 'en'],
      isAccessibleForFree: true,
      ...(canonical ? { url: canonical } : {}),
      featureList:
        language === 'en'
          ? [
              'Left and right window seat recommendations',
              'Sun and shade preferences',
              'Sunrise and sunset along the flight path',
              'Airport local time and daylight saving time',
              'Shareable flight URLs',
            ]
          : [
              '왼쪽·오른쪽 창가 추천',
              '그늘·햇빛 선호 선택',
              '비행 중 일출·일몰 위치',
              '공항 현지 시간과 서머타임 반영',
              '항공편 URL 공유',
            ],
    },
  }
}

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  )

export function metadataHead(language, siteUrl = '') {
  const metadata = pageMetadata(language, siteUrl)
  return [
    `<title>${escapeHtml(metadata.title)}</title>`,
    `<meta name="description" content="${escapeHtml(metadata.description)}">`,
    '<meta name="robots" content="index,follow,max-image-preview:large">',
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeHtml(metadata.title)}">`,
    `<meta property="og:description" content="${escapeHtml(metadata.description)}">`,
    `<meta property="og:locale" content="${language === 'en' ? 'en_GB' : 'ko_KR'}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${escapeHtml(metadata.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(metadata.description)}">`,
    ...(metadata.canonical
      ? [
          `<link rel="canonical" href="${escapeHtml(metadata.canonical)}">`,
          `<meta property="og:url" content="${escapeHtml(metadata.canonical)}">`,
          ...Object.entries(metadata.alternates).map(
            ([lang, url]) => `<link rel="alternate" hreflang="${lang}" href="${escapeHtml(url)}">`,
          ),
        ]
      : []),
    `<script type="application/ld+json" id="app-schema">${JSON.stringify(metadata.schema).replaceAll('<', '\\u003c')}</script>`,
  ].join('\n')
}

export function updatePageMetadata(language, siteUrl, title) {
  const metadata = pageMetadata(language, siteUrl)
  document.documentElement.lang = language
  document.title = title || metadata.title
  for (const [selector, value] of [
    ['meta[name="description"]', metadata.description],
    ['meta[property="og:title"]', title || metadata.title],
    ['meta[property="og:description"]', metadata.description],
    ['meta[property="og:url"]', metadata.canonical],
    ['meta[property="og:locale"]', language === 'en' ? 'en_GB' : 'ko_KR'],
    ['meta[name="twitter:title"]', title || metadata.title],
    ['meta[name="twitter:description"]', metadata.description],
  ])
    document.querySelector(selector)?.setAttribute('content', value)
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', metadata.canonical)
  const schema = document.getElementById('app-schema')
  if (schema) schema.textContent = JSON.stringify(metadata.schema)
}
