import ko from './ko.js'
import en from './en.js'

export const I18N_MESSAGES = { ko, en }

export function translate(language, key, values = {}) {
  const message = I18N_MESSAGES[language]?.[key] ?? ko[key] ?? key
  return message.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match)
}

export function languageFromPath(pathname) {
  return /\/en\/?$/.test(pathname) ? 'en' : 'ko'
}

export function languagePath(base, language) {
  return `${base}${language === 'en' ? 'en/' : ''}`
}
