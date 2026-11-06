<script setup>
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  CircleHelp,
  CircleOff,
  Link,
  Moon,
  Pause,
  Plane,
  Play,
  Share2,
  Sun,
  Sunrise,
  Sunset,
  X,
} from '@lucide/vue'
import FlightShadeAircraftIcon from '~/components/projects/flight-shade/FlightShadeAircraftIcon.vue'
import FlightShadeAirportInput from '~/components/projects/flight-shade/FlightShadeAirportInput.vue'
import featuredAirports from '~/assets/data/featured-airports.js'
import airportDataUrl from '~/assets/data/airports.json?url'
import { airportLabels } from '~/assets/data/airport-labels.js'
import { I18N_MESSAGES, languageFromPath, languagePath, translate } from '~/i18n/index.js'
import { estimateDuration } from '~/utils/geo.js'
import {
  calculateFlight,
  flightUrl,
  formatDuration,
  formatTime,
  readFlightParams,
  sunAt,
  FLIGHT_PREFERENCES,
} from '~/utils/flight.js'
import { updatePageMetadata } from '~/utils/metadata.js'

const FlightShadeMap = defineAsyncComponent(
  () => import('~/components/projects/flight-shade/FlightShadeMap.vue'),
)
const props = defineProps({ initialLanguage: { type: String, default: 'ko' } })
const language = ref(props.initialLanguage)
const t = (key, values) => translate(language.value, key, values)
const locale = computed(() => I18N_MESSAGES[language.value].locale)
const homeUrl = computed(() => languagePath(import.meta.env.BASE_URL, language.value))
const city = (airport) =>
  language.value === 'en' ? airport.city || airport.name : airport.cityLabel
const clock = (date, zone) => formatTime(date, zone, language.value)
const durationText = (minutes) => formatDuration(minutes, language.value)

function prepareAirports(data) {
  return data.map((airport) => {
    const [cityLabel, nameLabel] = airportLabels[airport.code] || [
      airport.city || airport.name,
      airport.name,
    ]
    return {
      ...airport,
      cityLabel,
      nameLabel,
      search:
        `${airport.code} ${airport.name} ${airport.city} ${cityLabel} ${nameLabel}`.toLowerCase(),
    }
  })
}
const airports = shallowRef(prepareAirports(featuredAirports))
const airportIndex = computed(
  () => new Map(airports.value.map((airport) => [airport.code, airport])),
)
const findAirport = (code) => airportIndex.value.get(code.trim().toUpperCase())
const airportLoading = ref(false)
const airportLoadError = ref(false)
let airportRequest,
  airportsLoaded = false
async function loadAirports() {
  if (airportsLoaded) return true
  if (airportRequest) return airportRequest
  airportLoading.value = true
  airportLoadError.value = false
  airportRequest = (async () => {
    try {
      const response = await fetch(airportDataUrl, { cache: 'force-cache' })
      if (!response.ok) throw new Error('Airport request failed')
      airports.value = prepareAirports(await response.json())
      airportsLoaded = true
      return true
    } catch {
      airportLoadError.value = true
      return false
    } finally {
      airportLoading.value = false
      airportRequest = null
    }
  })()
  return airportRequest
}

const from = ref('ICN'),
  to = ref('KIX')
const date = ref('2026-11-07'),
  time = ref('14:50')
const hours = ref(1),
  minutes = ref(25),
  preference = ref('shade')
const errorKey = ref('')
const error = computed(() => (errorKey.value ? t(errorKey.value) : ''))
const toastKey = ref('')
const toast = computed(() => (toastKey.value ? t(toastKey.value) : ''))
const progress = ref(0.25),
  playing = ref(false)
const guideDialog = ref(null),
  shareDialog = ref(null)
const sharedUrl = ref(''),
  shareSupported = ref(false)
const isMobile = ref(false),
  sheetState = ref('open'),
  sheetDrag = ref(0),
  sheetDragging = ref(false)
const flightPanel = ref(null),
  sheetHandle = ref(null),
  sheetSummary = ref(null),
  seatCard = ref(null)
const mapTopInset = ref(0),
  mapReady = ref(false),
  loadingFlight = ref(false)
const resultAnnouncement = ref('')
const sheetOpen = computed(() => isMobile.value && sheetState.value !== 'collapsed')
let seatObserver,
  mobileMedia,
  dragStartY,
  dragPointer,
  sheetDragged = false
let playTimer,
  toastTimer,
  applyTimer,
  viewportFrame,
  ready = false,
  restoring = false,
  restoreVersion = 0
const flight = shallowRef(
  calculateFlight({
    from: findAirport('ICN'),
    to: findAirport('KIX'),
    date: date.value,
    time: time.value,
    duration: 85,
  }),
)
let lastSignature = ''
const snapshot = computed(() =>
  sunAt(
    flight.value.from,
    flight.value.to,
    flight.value.departure,
    flight.value.duration,
    Number(progress.value),
  ),
)
const percentageItems = computed(() => [
  { key: 'left', label: t('leftSun'), icon: Sun, value: flight.value.percentages.left },
  { key: 'right', label: t('rightSun'), icon: Sun, value: flight.value.percentages.right },
  { key: 'front', label: t('frontSun'), icon: ArrowUpDown, value: flight.value.percentages.front },
  { key: 'night', label: t('nightFlight'), icon: Moon, value: flight.value.percentages.night },
])
const recommendedSide = computed(() => flight.value.recommendation)
const frontEvent = computed(() => ['front', 'back'].includes(flight.value.targetEvent?.viewSide))
const diagramSunSide = computed(() => {
  if (flight.value.targetEvent) return flight.value.targetEvent.viewSide
  const { left, right } = flight.value.percentages
  return left === right ? null : left > right ? 'left' : 'right'
})
const recommendedIcon = computed(() => {
  if (recommendedSide.value === 'none') return CircleOff
  if (frontEvent.value) return flight.value.targetEvent.viewSide === 'front' ? ArrowUp : ArrowDown
  return recommendedSide.value === 'left'
    ? ArrowLeft
    : recommendedSide.value === 'right'
      ? ArrowRight
      : Check
})
const recommendedTitle = computed(() => {
  if (recommendedSide.value === 'none')
    return t(flight.value.preference === 'sunrise' ? 'noSunrise' : 'noSunset')
  if (frontEvent.value)
    return t(flight.value.targetEvent.viewSide === 'front' ? 'sunAhead' : 'sunBehind')
  if (recommendedSide.value === 'left') return t('leftWindow')
  if (recommendedSide.value === 'right') return t('rightWindow')
  if (flight.value.preference === 'sun' && flight.value.percentages.night === 100)
    return t('noSunlight')
  return t('eitherWindow')
})
const sunEvents = computed(() => {
  const formatter = new Intl.DateTimeFormat(locale.value, {
    timeZone: flight.value.from.tz,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return flight.value.sunEvents.map((event) => ({
    ...event,
    label: t(event.type === 'sunrise' ? 'sunriseFlight' : 'sunsetFlight'),
    icon: event.type === 'sunrise' ? Sunrise : Sunset,
    time: clock(event.instant, flight.value.from.tz),
    title: t('eventTitle', {
      event: t(event.type === 'sunrise' ? 'sunriseName' : 'sunsetName'),
      date: formatter.format(event.instant),
    }),
  }))
})
const sideKeys = { left: 'sunLeft', right: 'sunRight', front: 'sunFront', night: 'night' }
const fullSideKeys = {
  left: 'sunLeftFull',
  right: 'sunRightFull',
  front: 'sunFrontFull',
  night: 'nightFull',
}
const sunSideLabel = computed(() => t(sideKeys[snapshot.value.side]))
const sunSideText = computed(() => t(fullSideKeys[snapshot.value.side]))
const elapsed = computed(() => Math.round(flight.value.duration * Number(progress.value)))
const airportDate = (instant, zone) =>
  new Intl.DateTimeFormat(locale.value, { timeZone: zone, month: 'short', day: 'numeric' }).format(
    instant,
  )
const departureDate = computed(() => airportDate(flight.value.departure, flight.value.from.tz))
const arrivalDate = computed(() => airportDate(flight.value.arrival, flight.value.to.tz))
const guideItems = [
  ['guideTime', 'guideTimeAnswer'],
  ['guideSides', 'guideSidesAnswer'],
  ['guideRatio', 'guideRatioAnswer'],
  ['guideEvents', 'guideEventsAnswer'],
  ['guideAccuracy', 'guideAccuracyAnswer'],
]

function notify(key) {
  toastKey.value = key
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastKey.value = ''
  }, 3500)
}
function setEstimate() {
  const origin = findAirport(from.value),
    destination = findAirport(to.value)
  if (!origin || !destination || origin.code === destination.code) return
  const duration = estimateDuration(origin, destination)
  hours.value = Math.floor(duration / 60)
  minutes.value = duration % 60
}
function onAirportSelected() {
  setEstimate()
  applyFlight({ push: true })
}
function onAirportConfirmed() {
  applyFlight({ closeSheet: isMobile.value, push: true })
}
function swapAirports() {
  const previous = from.value
  from.value = to.value
  to.value = previous
  setEstimate()
  applyFlight({ push: true })
}
function stopPlaying() {
  playing.value = false
  clearInterval(playTimer)
}
function togglePlaying() {
  if (playing.value) return stopPlaying()
  if (Number(progress.value) >= 1) progress.value = 0
  playing.value = true
  playTimer = setInterval(() => {
    progress.value = Math.min(1, Number(progress.value) + 0.003)
    if (progress.value >= 1) stopPlaying()
  }, 120)
}
function seekSunEvent(event) {
  stopPlaying()
  progress.value = event.fraction
}
function currentShareUrl() {
  const url = new URL(window.location.href)
  url.pathname = languagePath(import.meta.env.BASE_URL, language.value)
  return flightUrl(flight.value, url.href)
}
function syncDocument() {
  if (!ready) return
  const title = new URLSearchParams(window.location.search).has('from')
    ? `${flight.value.from.code} → ${flight.value.to.code} · ${recommendedTitle.value} | Flight Shade`
    : undefined
  updatePageMetadata(language.value, import.meta.env.VITE_SITE_URL || '', title)
  sharedUrl.value = currentShareUrl()
}
function applyFlight({ closeSheet = false, push = false, showErrors = true } = {}) {
  clearTimeout(applyTimer)
  try {
    const origin = findAirport(from.value),
      destination = findAirport(to.value)
    if (!origin || !destination) throw Object.assign(new Error(), { code: 'airportInvalid' })
    if (
      hours.value === '' ||
      minutes.value === '' ||
      !Number.isInteger(Number(hours.value)) ||
      !Number.isInteger(Number(minutes.value)) ||
      Number(hours.value) < 0 ||
      Number(minutes.value) < 0 ||
      Number(minutes.value) > 59
    )
      throw Object.assign(new Error(), { code: 'invalidMinutes' })
    const duration = Number(hours.value) * 60 + Number(minutes.value)
    const signature = [
      origin.code,
      destination.code,
      date.value,
      time.value,
      duration,
      preference.value,
    ].join('|')
    if (signature !== lastSignature) {
      const nextFlight = calculateFlight({
        from: origin,
        to: destination,
        date: date.value,
        time: time.value,
        duration,
        preference: preference.value,
      })
      stopPlaying()
      flight.value = nextFlight
      from.value = origin.code
      to.value = destination.code
      progress.value = nextFlight.targetEvent?.fraction ?? 0.25
      lastSignature = signature
      resultAnnouncement.value = t('updated', {
        from: origin.code,
        to: destination.code,
        seat: recommendedTitle.value,
      })
    }
    errorKey.value = ''
    if (ready && !restoring) {
      const url = currentShareUrl()
      if (url !== window.location.href)
        window.history[push ? 'pushState' : 'replaceState']({}, '', url)
    }
    if (closeSheet && isMobile.value) setSheet('collapsed')
    syncDocument()
    return true
  } catch (cause) {
    if (showErrors) {
      errorKey.value = cause.code || 'invalidFlight'
      nextTick(() =>
        flightPanel.value?.querySelector('.form-error')?.scrollIntoView({ block: 'nearest' }),
      )
    }
    return false
  }
}
function scheduleApply() {
  if (!ready || restoring) return
  clearTimeout(applyTimer)
  applyTimer = setTimeout(() => applyFlight({ showErrors: false }), 150)
}
async function loadFromUrl() {
  clearTimeout(applyTimer)
  const version = ++restoreVersion
  restoring = true
  loadingFlight.value = true
  try {
    language.value = languageFromPath(window.location.pathname)
    const params = readFlightParams(window.location.href) || {
      from: 'ICN',
      to: 'KIX',
      date: '2026-11-07',
      time: '14:50',
      duration: 85,
    }
    if (!findAirport(params.from) || !findAirport(params.to)) await loadAirports()
    if (version !== restoreVersion) return
    from.value = params.from
    to.value = params.to
    date.value = params.date
    time.value = params.time
    hours.value = Math.floor(params.duration / 60)
    minutes.value = params.duration % 60
    preference.value = params.preference || 'shade'
    if (!applyFlight()) sheetState.value = 'open'
    else if (isMobile.value && readFlightParams(window.location.href))
      sheetState.value = 'collapsed'
  } catch (cause) {
    errorKey.value = cause.code || 'invalidFlight'
    sheetState.value = 'open'
  } finally {
    if (version === restoreVersion) {
      restoring = false
      loadingFlight.value = false
      document.getElementById('app')?.removeAttribute('data-flight-pending')
      syncDocument()
    }
  }
}
function changeLanguage(event) {
  language.value = event.target.value
  const url = new URL(currentShareUrl())
  window.history.pushState({}, '', url.href)
  syncDocument()
}
function openShare() {
  sharedUrl.value = currentShareUrl()
  shareDialog.value.showModal()
}
async function copyLink() {
  try {
    await navigator.clipboard.writeText(currentShareUrl())
    notify('copied')
  } catch {
    sharedUrl.value = currentShareUrl()
    if (!shareDialog.value.open) shareDialog.value.showModal()
    notify('copyManually')
  }
}
async function nativeShare() {
  try {
    await navigator.share({
      title: `Flight Shade · ${recommendedTitle.value}`,
      text: `${flight.value.from.code} → ${flight.value.to.code} · ${recommendedTitle.value}`,
      url: currentShareUrl(),
    })
  } catch (cause) {
    if (cause.name !== 'AbortError') notify('copyManually')
  }
}
function onVisibility() {
  if (document.hidden) stopPlaying()
}

function setSheet(state) {
  sheetState.value = state
  sheetDrag.value = 0
  if (!isMobile.value) return
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  nextTick(() =>
    (state === 'collapsed' ? sheetSummary.value : sheetHandle.value)?.focus({
      preventScroll: true,
    }),
  )
}
function toggleSheet() {
  if (sheetDragged) {
    sheetDragged = false
    return
  }
  setSheet(sheetState.value === 'collapsed' ? 'open' : 'collapsed')
}
function startSheetDrag(event) {
  if (!isMobile.value || event.button !== 0) return
  dragStartY = event.clientY
  dragPointer = event.pointerId
  sheetDragged = false
  sheetDragging.value = true
  event.currentTarget.setPointerCapture(event.pointerId)
}
function moveSheetDrag(event) {
  if (!sheetDragging.value || event.pointerId !== dragPointer) return
  const delta = event.clientY - dragStartY
  if (Math.abs(delta) > 8) sheetDragged = true
  sheetDrag.value = Math.max(sheetState.value === 'expanded' ? 0 : -300, Math.min(250, delta))
}
function endSheetDrag(event) {
  if (!sheetDragging.value || event.pointerId !== dragPointer) return
  const delta = event.clientY - dragStartY
  sheetDragging.value = false
  sheetDrag.value = 0
  if (event.type === 'pointercancel' || !sheetDragged) return
  if (delta < -45) setSheet(sheetState.value === 'collapsed' ? 'open' : 'expanded')
  if (delta > 45) setSheet(sheetState.value === 'expanded' ? 'open' : 'collapsed')
}
function expandForInput(event) {
  if (
    isMobile.value &&
    (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)
  )
    sheetState.value = 'expanded'
}
function onSheetKeydown(event) {
  if (!sheetOpen.value || document.querySelector('dialog[open]')) return
  if (event.key === 'Escape') {
    event.preventDefault()
    setSheet('collapsed')
    return
  }
  if (event.key !== 'Tab') return
  const controls = [
    ...flightPanel.value.querySelectorAll('button, input, select, [tabindex="0"]'),
  ].filter((element) => !element.disabled && element.offsetParent !== null)
  const first = controls[0],
    last = controls[controls.length - 1]
  if (!flightPanel.value.contains(document.activeElement)) {
    event.preventDefault()
    first?.focus()
  } else if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === flightPanel.value)
  ) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

function updateViewport() {
  cancelAnimationFrame(viewportFrame)
  viewportFrame = requestAnimationFrame(() => {
    isMobile.value = mobileMedia.matches
    document.documentElement.style.setProperty(
      '--app-height',
      `${window.visualViewport?.height || window.innerHeight}px`,
    )
  })
}
onMounted(async () => {
  ready = true
  mobileMedia = window.matchMedia('(max-width: 960px)')
  isMobile.value = mobileMedia.matches
  updateViewport()
  shareSupported.value = typeof navigator.share === 'function'
  window.addEventListener('popstate', loadFromUrl)
  document.addEventListener('visibilitychange', onVisibility)
  mobileMedia.addEventListener('change', updateViewport)
  window.addEventListener('resize', updateViewport)
  window.visualViewport?.addEventListener('resize', updateViewport)
  document.addEventListener('keydown', onSheetKeydown)
  seatObserver = new ResizeObserver(() => {
    if (seatCard.value) mapTopInset.value = seatCard.value.getBoundingClientRect().height + 64
  })
  seatObserver.observe(seatCard.value)
  await loadFromUrl()
  mapReady.value = true
  if (sheetOpen.value) nextTick(() => flightPanel.value?.focus({ preventScroll: true }))
})
onUnmounted(() => {
  ready = false
  restoreVersion++
  stopPlaying()
  clearTimeout(toastTimer)
  clearTimeout(applyTimer)
  cancelAnimationFrame(viewportFrame)
  window.removeEventListener('popstate', loadFromUrl)
  document.removeEventListener('visibilitychange', onVisibility)
  mobileMedia?.removeEventListener('change', updateViewport)
  window.removeEventListener('resize', updateViewport)
  window.visualViewport?.removeEventListener('resize', updateViewport)
  document.removeEventListener('keydown', onSheetKeydown)
  seatObserver?.disconnect()
  document.documentElement.style.removeProperty('--app-height')
})
watch([date, time, hours, minutes, preference], scheduleApply)
watch(language, () => {
  resultAnnouncement.value = t('updated', {
    from: flight.value.from.code,
    to: flight.value.to.code,
    seat: recommendedTitle.value,
  })
  syncDocument()
})
</script>

<template>
  <a class="skip-link" href="#flight-form" @click="isMobile && setSheet('expanded')">{{
    t('skip')
  }}</a>
  <header class="header" :inert="sheetOpen">
    <a class="wordmark" :href="homeUrl" :aria-label="t('home')"
      ><span class="wordmark__icon"><FlightShadeAircraftIcon /></span>flight<span>shade</span
      ><span class="wordmark__dot">.</span></a
    >
    <nav class="header__nav" :aria-label="t('navigation')">
      <select
        v-model="language"
        class="language-select"
        :aria-label="t('language')"
        @change="changeLanguage"
      >
        <option value="ko" lang="ko">한국어</option>
        <option value="en" lang="en">English</option>
      </select>
      <button
        type="button"
        :aria-label="t('help')"
        :title="t('help')"
        @click="guideDialog.showModal()"
      >
        <CircleHelp :size="21" />
      </button>
    </nav>
  </header>

  <main class="dashboard">
    <h1 class="sr-only">{{ t('appHeading') }}</h1>
    <div class="workspace">
      <button
        v-if="sheetOpen"
        type="button"
        class="sheet-backdrop"
        aria-hidden="true"
        tabindex="-1"
        @click="setSheet('collapsed')"
      />
      <aside
        ref="flightPanel"
        class="flight-panel"
        :tabindex="sheetOpen ? -1 : undefined"
        :class="[`flight-panel--${sheetState}`, { 'is-dragging': sheetDragging }]"
        :style="{ '--sheet-drag': `${sheetDrag}px` }"
        :role="sheetOpen ? 'dialog' : undefined"
        :aria-modal="sheetOpen ? true : undefined"
        :aria-label="t('routeSettings')"
      >
        <p class="sr-only" role="status" aria-live="polite">{{ resultAnnouncement }}</p>
        <button
          ref="sheetHandle"
          type="button"
          class="flight-panel__handle"
          :aria-label="t(sheetState === 'collapsed' ? 'expandRoute' : 'collapseRoute')"
          :aria-expanded="sheetState !== 'collapsed'"
          aria-controls="flight-panel-body"
          @pointerdown="startSheetDrag"
          @pointermove="moveSheetDrag"
          @pointerup="endSheetDrag"
          @pointercancel="endSheetDrag"
          @click="toggleSheet"
        >
          <span />
        </button>
        <button
          ref="sheetSummary"
          type="button"
          class="flight-panel__summary"
          :aria-expanded="sheetState !== 'collapsed'"
          aria-controls="flight-panel-body"
          @click="toggleSheet"
        >
          <div v-if="sheetState === 'collapsed'">
            <strong class="mono"
              >{{ flight.from.code }} <ArrowRight :size="18" /> {{ flight.to.code }}</strong
            >
            <span
              >{{ departureDate }} · {{ flight.time }} · {{ durationText(flight.duration) }}</span
            >
          </div>
          <div v-else>
            <strong>{{ t('routeSettings') }}</strong>
          </div>
          <span class="flight-panel__summary-action"
            >{{ t(sheetState === 'collapsed' ? 'changeRoute' : 'collapse')
            }}<ChevronUp v-if="sheetState === 'collapsed'" :size="16" /><ChevronDown
              v-else
              :size="16"
          /></span>
        </button>
        <div
          id="flight-panel-body"
          class="flight-panel__body"
          :inert="isMobile && sheetState === 'collapsed'"
          :aria-hidden="isMobile && sheetState === 'collapsed' ? true : undefined"
          @focusin="expandForInput"
        >
          <form
            id="flight-form"
            class="flight-form"
            @submit.prevent="applyFlight({ closeSheet: isMobile, push: true })"
            @change="applyFlight()"
            :aria-describedby="error ? 'flight-error' : undefined"
          >
            <h2>{{ t('routeSettings') }}</h2>
            <div class="flight-form__airports">
              <FlightShadeAirportInput
                id="from-airport"
                v-model="from"
                :label="t('from')"
                :airports="airports"
                :language="language"
                :loading="airportLoading"
                :invalid="errorKey === 'sameAirport'"
                :error-id="error ? 'flight-error' : ''"
                @search="loadAirports"
                @invalid="errorKey = 'airportInvalid'"
                @select="onAirportSelected"
                @confirm="onAirportConfirmed"
              />
              <button
                type="button"
                class="flight-form__swap"
                :aria-label="t('swap')"
                :title="t('swap')"
                @click="swapAirports"
              >
                <ArrowUpDown :size="16" />
              </button>
              <FlightShadeAirportInput
                id="to-airport"
                v-model="to"
                :label="t('to')"
                :airports="airports"
                :language="language"
                :loading="airportLoading"
                :invalid="errorKey === 'sameAirport'"
                :error-id="error ? 'flight-error' : ''"
                @search="loadAirports"
                @invalid="errorKey = 'airportInvalid'"
                @select="onAirportSelected"
                @confirm="onAirportConfirmed"
              />
            </div>
            <div class="flight-form__rule" />
            <div class="flight-form__dates">
              <div class="field">
                <label for="departure-date" class="field-label">{{ t('date') }}</label>
                <div class="field__control">
                  <input
                    id="departure-date"
                    v-model="date"
                    type="date"
                    min="2000-01-01"
                    max="2100-12-31"
                    required
                    :aria-invalid="['invalidDate', 'skippedTime'].includes(errorKey)"
                    :aria-describedby="
                      ['invalidDate', 'skippedTime'].includes(errorKey) ? 'flight-error' : undefined
                    "
                  />
                </div>
              </div>
              <div class="field">
                <label for="departure-time" class="field-label">{{ t('time') }}</label>
                <div class="field__control">
                  <input
                    id="departure-time"
                    v-model="time"
                    type="time"
                    required
                    :aria-invalid="['invalidDate', 'skippedTime'].includes(errorKey)"
                    :aria-describedby="
                      ['invalidDate', 'skippedTime'].includes(errorKey) ? 'flight-error' : undefined
                    "
                  />
                </div>
              </div>
            </div>
            <div class="field flight-form__duration">
              <label for="duration-hours" class="field-label">{{ t('duration') }}</label>
              <div class="duration-input">
                <Clock3 :size="16" /><input
                  id="duration-hours"
                  v-model="hours"
                  type="number"
                  min="0"
                  max="24"
                  required
                  :aria-label="t('durationHours')"
                  :aria-invalid="['invalidDuration', 'invalidMinutes'].includes(errorKey)"
                  :aria-describedby="
                    ['invalidDuration', 'invalidMinutes'].includes(errorKey)
                      ? 'flight-error'
                      : undefined
                  "
                /><span>{{ t('hours') }}</span
                ><input
                  id="duration-minutes"
                  v-model="minutes"
                  type="number"
                  min="0"
                  max="59"
                  required
                  :aria-label="t('durationMinutes')"
                  :aria-invalid="['invalidDuration', 'invalidMinutes'].includes(errorKey)"
                  :aria-describedby="
                    ['invalidDuration', 'invalidMinutes'].includes(errorKey)
                      ? 'flight-error'
                      : undefined
                  "
                /><span>{{ t('minutes') }}</span>
              </div>
            </div>
            <div class="field flight-form__preference">
              <label for="seat-preference" class="field-label">{{ t('preference') }}</label>
              <div class="field__control">
                <select
                  id="seat-preference"
                  v-model="preference"
                  :aria-invalid="errorKey === 'invalidPreference'"
                  :aria-describedby="errorKey === 'invalidPreference' ? 'flight-error' : undefined"
                >
                  <option v-for="option in FLIGHT_PREFERENCES" :key="option" :value="option">
                    {{ t(option) }}
                  </option>
                </select>
              </div>
            </div>
            <p v-if="airportLoadError" class="form-error" role="status">
              {{ t('airportLoadFailed') }}
              <button type="button" @click="loadAirports">{{ t('retry') }}</button>
            </p>
            <p v-if="error" id="flight-error" class="form-error" role="alert">{{ error }}</p>
          </form>
        </div>
        <div
          v-if="isMobile"
          class="flight-panel__footer"
          :inert="isMobile && sheetState === 'collapsed'"
        >
          <button class="primary-button flight-form__submit" type="submit" form="flight-form">
            {{ t('viewResults') }}<ArrowRight :size="18" />
          </button>
        </div>
      </aside>

      <section
        :aria-busy="loadingFlight"
        class="flight-view"
        :aria-label="t('results')"
        :inert="sheetOpen"
      >
        <div class="flight-view__map-area">
          <FlightShadeMap
            v-if="mapReady"
            :language="language"
            :flight="flight"
            :snapshot="snapshot"
            :mobile="isMobile"
            :top-inset="mapTopInset"
          />
          <div v-else class="flight-map" role="region" :aria-label="t('mapLoading')" />
          <p v-if="loadingFlight" class="flight-view__loading" role="status">
            {{ t('loadingFlight') }}
          </p>
          <article
            ref="seatCard"
            class="seat-card"
            :class="{
              'seat-card--either': recommendedSide === 'either',
              'seat-card--notice': recommendedSide === 'none' || frontEvent,
            }"
            :aria-label="t('recommendedSeat')"
            aria-atomic="true"
          >
            <div class="seat-card__recommendation">
              <h2><component :is="recommendedIcon" :size="33" />{{ recommendedTitle }}</h2>
              <div v-if="sunEvents.length" class="seat-card__events">
                <button
                  v-for="event in sunEvents"
                  :key="event.instant.getTime()"
                  type="button"
                  :class="`is-${event.type}`"
                  :title="event.title"
                  :aria-label="event.title"
                  @click="seekSunEvent(event)"
                >
                  <component :is="event.icon" :size="14" /><span>{{ event.label }}</span>
                  <time class="mono" :datetime="event.instant.toISOString()">{{ event.time }}</time>
                </button>
              </div>
            </div>
            <div
              v-if="recommendedSide !== 'none' && !frontEvent"
              class="seat-diagram"
              :aria-label="t('planeSides')"
            >
              <div
                class="seat-diagram__side"
                :class="{
                  'is-recommended': recommendedSide === 'left' || recommendedSide === 'either',
                }"
              >
                <span v-for="i in 5" :key="i" /><b
                  ><Check
                    v-if="recommendedSide === 'left' || recommendedSide === 'either'"
                    :size="10"
                  />{{ t('left') }}</b
                >
              </div>
              <FlightShadeAircraftIcon class="seat-diagram__plane" />
              <div
                class="seat-diagram__side"
                :class="{
                  'is-recommended': recommendedSide === 'right' || recommendedSide === 'either',
                }"
              >
                <span v-for="i in 5" :key="i" /><b
                  ><Check
                    v-if="recommendedSide === 'right' || recommendedSide === 'either'"
                    :size="10"
                  />{{ t('right') }}</b
                >
              </div>
              <Sun
                v-if="diagramSunSide === 'right'"
                class="seat-diagram__sun seat-diagram__sun--right"
                :size="25"
              />
              <Sun
                v-else-if="diagramSunSide === 'left'"
                class="seat-diagram__sun seat-diagram__sun--left"
                :size="25"
              />
            </div>
            <div class="seat-card__stats">
              <div v-for="item in percentageItems" :key="item.key">
                <span><component :is="item.icon" :size="12" />{{ item.label }}</span
                ><b class="mono">{{ item.value }}<small>%</small></b>
              </div>
            </div>
            <div class="seat-card__actions">
              <button type="button" @click="copyLink"><Link :size="14" />{{ t('copyLink') }}</button
              ><button type="button" @click="openShare">
                <Share2 :size="14" />{{ t('share') }}
              </button>
            </div>
          </article>
          <div class="flight-view__live">
            <component :is="snapshot.side === 'night' ? Moon : Sun" :size="14" /><span>{{
              sunSideLabel
            }}</span
            ><span class="mono">{{ clock(snapshot.instant, flight.from.tz) }}</span>
          </div>
        </div>

        <div class="flight-timeline">
          <div
            class="flight-timeline__player"
            :class="{ 'flight-timeline__player--events': sunEvents.length }"
          >
            <button
              type="button"
              class="flight-timeline__play"
              :aria-label="t(playing ? 'pause' : 'play')"
              @click="togglePlaying"
            >
              <Pause v-if="playing" :size="15" /><Play v-else :size="15" />
            </button>
            <div class="flight-timeline__track">
              <div class="flight-timeline__segments" aria-hidden="true">
                <span
                  v-for="(sample, index) in flight.samples"
                  :key="index"
                  :class="`is-${sample.side}`"
                />
              </div>
              <div v-if="sunEvents.length" class="flight-timeline__events">
                <button
                  v-for="event in sunEvents"
                  :key="event.instant.getTime()"
                  type="button"
                  :class="`is-${event.type}`"
                  :style="{ left: `${event.fraction * 100}%` }"
                  :title="event.title"
                  :aria-label="t('seekEvent', { event: event.title })"
                  @click="seekSunEvent(event)"
                >
                  <component :is="event.icon" :size="15" />
                </button>
              </div>
              <input
                v-model="progress"
                type="range"
                min="0"
                max="1"
                step="0.001"
                :aria-label="t('progress')"
                :aria-valuetext="t('progressText', { minutes: elapsed, position: sunSideText })"
                @input="stopPlaying"
              />
            </div>
            <span class="flight-timeline__elapsed mono" :aria-label="t('elapsed')">{{
              t('elapsedText', { elapsed, duration: flight.duration })
            }}</span>
          </div>
          <div class="route-summary">
            <div role="group" :aria-label="t('departure')">
              <b class="mono"
                >{{ flight.from.code }}<small>{{ city(flight.from) }}</small></b
              >
              <p>{{ departureDate }} · {{ clock(flight.departure, flight.from.tz) }}</p>
            </div>
            <div class="route-summary__middle">
              <span>{{ durationText(flight.duration) }}</span>
              <div><i /><Plane :size="17" /><i /></div>
              <span>{{ flight.distance.toLocaleString() }} km</span>
            </div>
            <div class="route-summary__arrival" role="group" :aria-label="t('arrival')">
              <b class="mono"
                >{{ flight.to.code }}<small>{{ city(flight.to) }}</small></b
              >
              <p>{{ arrivalDate }} · {{ clock(flight.arrival, flight.to.tz) }}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>

  <dialog
    ref="guideDialog"
    class="guide-dialog"
    aria-labelledby="guide-title"
    @click="
      (event) => {
        if (event.target === guideDialog) guideDialog.close()
      }
    "
  >
    <div class="dialog-heading">
      <h2 id="guide-title">{{ t('help') }}</h2>
      <button
        type="button"
        class="icon-button"
        :aria-label="t('closeHelp')"
        @click="guideDialog.close()"
      >
        <X :size="20" />
      </button>
    </div>
    <dl class="guide-details">
      <div v-for="[question, answer] in guideItems" :key="question">
        <dt>{{ t(question) }}</dt>
        <dd>{{ t(answer) }}</dd>
      </div>
    </dl>
  </dialog>

  <dialog
    ref="shareDialog"
    class="share-dialog"
    aria-labelledby="share-title"
    @click="
      (event) => {
        if (event.target === shareDialog) shareDialog.close()
      }
    "
  >
    <div class="dialog-heading">
      <h2 id="share-title">{{ t('share') }}</h2>
      <button
        type="button"
        class="icon-button"
        :aria-label="t('closeShare')"
        @click="shareDialog.close()"
      >
        <X :size="20" />
      </button>
    </div>
    <div class="boarding-pass">
      <div class="boarding-pass__route">
        <div>
          <b class="mono">{{ flight.from.code }}</b
          ><span>{{ city(flight.from) }}</span>
        </div>
        <Plane :size="26" />
        <div>
          <b class="mono">{{ flight.to.code }}</b
          ><span>{{ city(flight.to) }}</span>
        </div>
      </div>
      <div class="boarding-pass__seat">
        <b>{{ recommendedTitle }}<component :is="recommendedIcon" :size="20" /></b>
      </div>
      <div v-if="sunEvents.length" class="boarding-pass__events">
        <span v-for="event in sunEvents" :key="event.instant.getTime()" :title="event.title">
          <component :is="event.icon" :size="15" />{{ event.label }}
          <time class="mono" :datetime="event.instant.toISOString()">{{ event.time }}</time>
        </span>
      </div>
      <div class="boarding-pass__bottom">
        <div :aria-label="t('localDeparture')">
          <b>{{ flight.date }} · {{ flight.time }}</b>
        </div>
        <div :aria-label="t('duration')">
          <b>{{ durationText(flight.duration) }}</b>
        </div>
      </div>
    </div>
    <label class="sr-only" for="share-url">{{ t('sharedLink') }}</label
    ><input
      id="share-url"
      class="share-dialog__url mono"
      :value="sharedUrl"
      readonly
      @focus="(event) => event.target.select()"
    />
    <button type="button" class="primary-button" @click="copyLink">
      <Copy :size="16" />{{ t('copyLink') }}
    </button>
    <button v-if="shareSupported" type="button" class="share-dialog__native" @click="nativeShare">
      <Share2 :size="15" />{{ t('shareOther') }}
    </button>
  </dialog>
  <Transition name="toast"
    ><div v-if="toast" class="toast-message" role="status">
      <Check :size="16" />{{ toast }}
    </div></Transition
  >
</template>
