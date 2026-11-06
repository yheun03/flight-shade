import test from 'node:test'
import assert from 'node:assert/strict'
import { I18N_MESSAGES, languageFromPath, languagePath, translate } from '../i18n/index.js'
import { formatDuration, formatTime } from '../utils/flight.js'
import { metadataHead, pageMetadata } from '../utils/metadata.js'

test('both languages cover the same messages and interpolation values', () => {
  assert.deepEqual(Object.keys(I18N_MESSAGES.ko).sort(), Object.keys(I18N_MESSAGES.en).sort())
  for (const key of Object.keys(I18N_MESSAGES.ko)) {
    const placeholders = (message) =>
      [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
    assert.deepEqual(placeholders(I18N_MESSAGES.ko[key]), placeholders(I18N_MESSAGES.en[key]), key)
    assert.ok(I18N_MESSAGES.en[key].trim(), key)
  }
  assert.equal(
    translate('en', 'updated', { from: 'ICN', to: 'KIX', seat: 'Right window' }),
    'ICN to KIX, Right window',
  )
})

test('language paths preserve the GitHub Pages project base', () => {
  assert.equal(languagePath('/flight-shade/', 'en'), '/flight-shade/en/')
  assert.equal(languagePath('/flight-shade/', 'ko'), '/flight-shade/')
  assert.equal(languagePath('/', 'en'), '/en/')
  assert.equal(languageFromPath('/flight-shade/en/'), 'en')
  assert.equal(languageFromPath('/flight-shade/en'), 'en')
  assert.equal(languageFromPath('/flight-shade/'), 'ko')
})

test('English time and duration keep airport local time without Korean units', () => {
  assert.equal(formatDuration(85, 'en'), '1h 25m')
  assert.equal(formatDuration(60, 'en'), '1h')
  assert.equal(formatDuration(85), '1시간 25분')
  assert.equal(formatTime(new Date('2026-07-15T16:00:00Z'), 'America/New_York', 'en'), '12:00')
})

test('metadata links both actual locale pages and consolidates flight query URLs', () => {
  const base = 'https://yheun03.github.io/flight-shade/'
  for (const language of ['ko', 'en']) {
    const metadata = pageMetadata(language, base)
    assert.equal(metadata.canonical, language === 'en' ? `${base}en/` : base)
    assert.deepEqual(metadata.alternates, { ko: base, en: `${base}en/`, 'x-default': base })
    assert.equal(metadata.schema['@type'], 'WebApplication')
    assert.equal(metadata.schema.isAccessibleForFree, true)
    assert.equal(metadata.schema.aggregateRating, undefined)
    assert.ok(metadataHead(language, base).includes('hreflang="en"'))
    assert.ok(!metadataHead(language).includes('rel="canonical"'))
  }
})
