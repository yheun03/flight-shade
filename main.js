import { createApp, createSSRApp } from 'vue'
import App from './app.vue'
import './assets/scss/main.scss'
import { languageFromPath } from './i18n/index.js'

const root = document.getElementById('app')
if (new URLSearchParams(window.location.search).has('from')) root.dataset.flightPending = 'true'
const app = (root.childElementCount ? createSSRApp : createApp)(App, {
  initialLanguage: languageFromPath(window.location.pathname),
})
app.mount(root)
