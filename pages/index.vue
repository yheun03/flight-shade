<script setup>
import { computed, nextTick, onBeforeMount, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  CircleHelp,
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
import FlightShadeMap from '~/components/projects/flight-shade/FlightShadeMap.vue'
import airportData from '~/assets/data/airports.json'
import { airportLabels } from '~/assets/data/airport-labels.js'
import { estimateDuration } from '~/utils/geo.js'
import {
  calculateFlight,
  flightUrl,
  formatDuration,
  formatTime,
  readFlightParams,
  sunAt,
} from '~/utils/flight.js'

const airports = airportData.map((airport) => {
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
const from = ref('ICN')
const to = ref('KIX')
const date = ref('2026-11-07')
const time = ref('14:50')
const hours = ref(1)
const minutes = ref(25)
const error = ref('')
const toast = ref('')
const progress = ref(0.25)
const playing = ref(false)
const guideDialog = ref(null)
const shareDialog = ref(null)
const sharedUrl = ref('')
const shareSupported = ref(false)
const isMobile = ref(false)
const sheetState = ref('open')
const sheetDrag = ref(0)
const sheetDragging = ref(false)
const flightPanel = ref(null)
const sheetHandle = ref(null)
const sheetSummary = ref(null)
const seatCard = ref(null)
const mapTopInset = ref(0)
const sheetOpen = computed(() => isMobile.value && sheetState.value !== 'collapsed')
let seatObserver,
  mobileMedia,
  dragStartY,
  dragPointer,
  sheetDragged = false
let playTimer, toastTimer
const findAirport = (code) => airports.find((airport) => airport.code === code.trim().toUpperCase())
const initialFlight = () =>
  calculateFlight({
    from: findAirport('ICN'),
    to: findAirport('KIX'),
    date: date.value,
    time: time.value,
    duration: 85,
  })
const flight = ref(initialFlight())
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
  { key: 'left', label: '왼쪽 햇빛', icon: Sun, value: flight.value.percentages.left },
  { key: 'right', label: '오른쪽 햇빛', icon: Sun, value: flight.value.percentages.right },
  { key: 'front', label: '앞·뒤 햇빛', icon: ArrowUpDown, value: flight.value.percentages.front },
  { key: 'night', label: '야간 비행', icon: Moon, value: flight.value.percentages.night },
])
const recommendedSide = computed(() => flight.value.recommendation)
const sunEvents = computed(() => {
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: flight.value.from.tz,
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return flight.value.sunEvents.map((event) => {
    const name = event.type === 'sunrise' ? '일출' : '일몰'
    return {
      ...event,
      label: `${name} 비행`,
      icon: event.type === 'sunrise' ? Sunrise : Sunset,
      time: formatTime(event.instant, flight.value.from.tz),
      title: `예상 ${name} · ${formatter.format(event.instant)} (출발 공항 현지 시간)`,
    }
  })
})
const recommendedTitle = computed(() =>
  recommendedSide.value === 'left'
    ? '왼쪽 창가'
    : recommendedSide.value === 'right'
      ? '오른쪽 창가'
      : '양쪽 모두 좋아요',
)
const sunSideText = computed(
  () =>
    ({
      left: '왼쪽에서 햇빛이 들어와요',
      right: '오른쪽에서 햇빛이 들어와요',
      front: '태양이 기체 앞·뒤에 있어요',
      night: '지금은 해가 지평선 아래에 있어요',
    })[snapshot.value.side],
)
const sunSideLabel = computed(
  () =>
    ({ left: '태양 · 왼쪽', right: '태양 · 오른쪽', front: '태양 · 앞·뒤', night: '야간' })[
      snapshot.value.side
    ],
)
const elapsed = computed(() => Math.round(flight.value.duration * Number(progress.value)))
const arrivalDate = computed(() =>
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: flight.value.to.tz,
    month: 'long',
    day: 'numeric',
  }).format(flight.value.arrival),
)
const departureDate = computed(() =>
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: flight.value.from.tz,
    month: 'long',
    day: 'numeric',
  }).format(flight.value.departure),
)

function notify(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 3500)
}
function setEstimate() {
  const origin = findAirport(from.value)
  const destination = findAirport(to.value)
  if (!origin || !destination || origin.code === destination.code) return
  const duration = estimateDuration(origin, destination)
  hours.value = Math.floor(duration / 60)
  minutes.value = duration % 60
}
function swapAirports() {
  const previous = from.value
  from.value = to.value
  to.value = previous
  setEstimate()
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
function submitFlight(updateUrl = true) {
  error.value = ''
  try {
    const origin = findAirport(from.value)
    const destination = findAirport(to.value)
    if (!origin || !destination)
      throw new Error('목록에서 공항을 선택하거나 올바른 IATA 공항 코드를 입력해 주세요.')
    if (
      hours.value === '' ||
      minutes.value === '' ||
      !Number.isInteger(Number(hours.value)) ||
      !Number.isInteger(Number(minutes.value)) ||
      Number(hours.value) < 0 ||
      Number(minutes.value) < 0 ||
      Number(minutes.value) > 59
    )
      throw new Error('비행시간의 시간과 분을 확인해 주세요. 분은 0~59로 입력해 주세요.')
    const nextFlight = calculateFlight({
      from: origin,
      to: destination,
      date: date.value,
      time: time.value,
      duration: Number(hours.value) * 60 + Number(minutes.value),
    })
    stopPlaying()
    flight.value = nextFlight
    from.value = origin.code
    to.value = destination.code
    progress.value = 0.25
    if (updateUrl) {
      window.history.pushState({}, '', flightUrl(nextFlight, window.location.href))
      if (isMobile.value) setSheet('collapsed')
    }
    sharedUrl.value = flightUrl(nextFlight, window.location.href)
    document.title = `${origin.code} → ${destination.code} · ${recommendedTitle.value} 추천 | Flight Shade`
    return true
  } catch (cause) {
    error.value = cause.message
    nextTick(() =>
      flightPanel.value?.querySelector('.form-error')?.scrollIntoView({ block: 'nearest' }),
    )
    return false
  }
}
function loadFromUrl() {
  try {
    const params = readFlightParams(window.location.href) || {
      from: 'ICN',
      to: 'KIX',
      date: '2026-11-07',
      time: '14:50',
      duration: 85,
    }
    from.value = params.from
    to.value = params.to
    date.value = params.date
    time.value = params.time
    hours.value = Math.floor(params.duration / 60)
    minutes.value = params.duration % 60
    if (!submitFlight(false)) {
      sheetState.value = 'open'
    } else if (isMobile.value && readFlightParams(window.location.href)) {
      sheetState.value = 'collapsed'
    }
  } catch (cause) {
    error.value = cause.message
  }
}
function openShare() {
  sharedUrl.value = flightUrl(flight.value, window.location.href)
  shareDialog.value.showModal()
}
async function copyLink() {
  const url = flightUrl(flight.value, window.location.href)
  try {
    await navigator.clipboard.writeText(url)
    notify('링크를 복사했습니다.')
  } catch {
    sharedUrl.value = url
    if (!shareDialog.value.open) shareDialog.value.showModal()
    notify('링크를 직접 복사해 주세요.')
  }
}
async function nativeShare() {
  try {
    await navigator.share({
      title: `Flight Shade · ${recommendedTitle.value}`,
      text: `${flight.value.from.code} → ${flight.value.to.code} · ${recommendedTitle.value} 추천`,
      url: sharedUrl.value,
    })
  } catch (cause) {
    if (cause.name !== 'AbortError') notify('링크를 복사해 주세요.')
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
  if (isMobile.value && event.target instanceof HTMLInputElement) sheetState.value = 'expanded'
}
function onSheetKeydown(event) {
  if (!sheetOpen.value || document.querySelector('dialog[open]')) return
  if (event.key === 'Escape') {
    event.preventDefault()
    setSheet('collapsed')
    return
  }
  if (event.key !== 'Tab') return
  const controls = [...flightPanel.value.querySelectorAll('button, input, [tabindex="0"]')].filter(
    (element) => !element.disabled && element.offsetParent !== null,
  )
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
  isMobile.value = mobileMedia.matches
  document.documentElement.style.setProperty(
    '--app-height',
    `${window.visualViewport?.height || window.innerHeight}px`,
  )
}
onBeforeMount(() => {
  mobileMedia = window.matchMedia('(max-width: 960px)')
  updateViewport()
  loadFromUrl()
})
onMounted(() => {
  sharedUrl.value = flightUrl(flight.value, window.location.href)
  shareSupported.value = typeof navigator.share === 'function'
  window.addEventListener('popstate', loadFromUrl)
  document.addEventListener('visibilitychange', onVisibility)
  mobileMedia.addEventListener('change', updateViewport)
  window.addEventListener('resize', updateViewport)
  window.visualViewport?.addEventListener('resize', updateViewport)
  document.addEventListener('keydown', onSheetKeydown)
  // Keep the route below the result panel as its text and viewport size change.
  seatObserver = new ResizeObserver(() => {
    mapTopInset.value = seatCard.value.getBoundingClientRect().height + 64
  })
  seatObserver.observe(seatCard.value)
  if (sheetOpen.value) nextTick(() => flightPanel.value?.focus({ preventScroll: true }))
})
onUnmounted(() => {
  stopPlaying()
  clearTimeout(toastTimer)
  window.removeEventListener('popstate', loadFromUrl)
  document.removeEventListener('visibilitychange', onVisibility)
  mobileMedia?.removeEventListener('change', updateViewport)
  window.removeEventListener('resize', updateViewport)
  window.visualViewport?.removeEventListener('resize', updateViewport)
  document.removeEventListener('keydown', onSheetKeydown)
  seatObserver?.disconnect()
  document.documentElement.style.removeProperty('--app-height')
})
watch(
  () => flight.value,
  () => {
    sharedUrl.value = flightUrl(flight.value, window.location.href)
  },
)
</script>

<template>
  <a class="skip-link" href="#flight-form" @click="isMobile && setSheet('expanded')"
    >항공편 입력으로 건너뛰기</a
  >
  <header class="header" :inert="sheetOpen">
    <a class="wordmark" href="./" aria-label="Flight Shade 홈"
      ><span class="wordmark__icon"><FlightShadeAircraftIcon /></span>flight<span>shade</span
      ><span class="wordmark__dot">.</span></a
    >
    <nav class="header__nav" aria-label="주 메뉴">
      <button
        type="button"
        aria-label="이용 안내"
        title="이용 안내"
        @click="guideDialog.showModal()"
      >
        <CircleHelp :size="21" />
      </button>
    </nav>
  </header>

  <main class="dashboard">
    <h1 class="sr-only">비행 그늘 좌석 추천</h1>
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
        aria-label="비행 경로 설정"
      >
        <button
          ref="sheetHandle"
          type="button"
          class="flight-panel__handle"
          :aria-label="sheetState === 'collapsed' ? '경로 설정 펼치기' : '경로 설정 접기'"
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
              >{{ departureDate }} · {{ flight.time }} · {{ formatDuration(flight.duration) }}</span
            >
          </div>
          <div v-else><strong>경로 설정</strong></div>
          <span class="flight-panel__summary-action"
            >{{ sheetState === 'collapsed' ? '경로 변경' : '접기'
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
          <form id="flight-form" class="flight-form" @submit.prevent="submitFlight()">
            <h2>경로 설정</h2>
            <div class="flight-form__airports">
              <FlightShadeAirportInput
                id="from-airport"
                v-model="from"
                label="출발 공항"
                :airports="airports"
                @select="setEstimate"
              />
              <button
                type="button"
                class="flight-form__swap"
                aria-label="출발 공항과 도착 공항 바꾸기"
                title="출발·도착 바꾸기"
                @click="swapAirports"
              >
                <ArrowUpDown :size="16" />
              </button>
              <FlightShadeAirportInput
                id="to-airport"
                v-model="to"
                label="도착 공항"
                :airports="airports"
                @select="setEstimate"
              />
            </div>
            <div class="flight-form__rule" />
            <div class="flight-form__dates">
              <div class="field">
                <label for="departure-date" class="field-label">출발 날짜</label>
                <div class="field__control">
                  <input
                    id="departure-date"
                    v-model="date"
                    type="date"
                    min="2000-01-01"
                    max="2100-12-31"
                    required
                  />
                </div>
              </div>
              <div class="field">
                <label for="departure-time" class="field-label">출발 시간 (현지)</label>
                <div class="field__control">
                  <input id="departure-time" v-model="time" type="time" required />
                </div>
              </div>
            </div>
            <div class="field flight-form__duration">
              <label for="duration-hours" class="field-label">비행시간</label>
              <div class="duration-input">
                <Clock3 :size="16" /><input
                  id="duration-hours"
                  v-model="hours"
                  type="number"
                  min="0"
                  max="24"
                  required
                  aria-label="비행시간 시"
                /><span>시간</span
                ><input
                  id="duration-minutes"
                  v-model="minutes"
                  type="number"
                  min="0"
                  max="59"
                  required
                  aria-label="비행시간 분"
                /><span>분</span>
              </div>
            </div>
            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          </form>
        </div>
        <div class="flight-panel__footer" :inert="isMobile && sheetState === 'collapsed'">
          <button class="primary-button flight-form__submit" type="submit" form="flight-form">
            <Sun :size="17" />그늘 좌석 찾기<ArrowRight :size="18" />
          </button>
        </div>
      </aside>

      <section class="flight-view" aria-label="좌석 추천 결과" :inert="sheetOpen">
        <div class="flight-view__map-area">
          <FlightShadeMap
            :flight="flight"
            :snapshot="snapshot"
            :mobile="isMobile"
            :top-inset="mapTopInset"
          />
          <article
            ref="seatCard"
            class="seat-card"
            :class="{ 'seat-card--either': recommendedSide === 'either' }"
            aria-label="추천 좌석"
            aria-live="polite"
            aria-atomic="true"
          >
            <div class="seat-card__recommendation">
              <h2>
                <ArrowLeft v-if="recommendedSide === 'left'" :size="33" /><ArrowRight
                  v-else-if="recommendedSide === 'right'"
                  :size="33"
                /><Check v-else :size="29" />{{ recommendedTitle }}
              </h2>
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
            <div class="seat-diagram" aria-label="기체 진행 방향을 바라볼 때의 좌우 좌석">
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
                  />왼쪽</b
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
                  />오른쪽</b
                >
              </div>
              <Sun
                v-if="flight.percentages.right > flight.percentages.left"
                class="seat-diagram__sun seat-diagram__sun--right"
                :size="25"
              />
              <Sun
                v-else-if="flight.percentages.left > flight.percentages.right"
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
              <button type="button" @click="copyLink"><Link :size="14" />링크 복사</button
              ><button type="button" @click="openShare"><Share2 :size="14" />결과 공유</button>
            </div>
          </article>
          <div class="flight-view__live">
            <component :is="snapshot.side === 'night' ? Moon : Sun" :size="14" /><span>{{
              sunSideLabel
            }}</span
            ><span class="mono">{{ formatTime(snapshot.instant, flight.from.tz) }}</span>
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
              :aria-label="playing ? '비행 시뮬레이션 일시정지' : '비행 시뮬레이션 재생'"
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
                  :aria-label="`${event.title} 시점으로 이동`"
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
                aria-label="비행 진행 시간"
                :aria-valuetext="`출발 후 ${elapsed}분, ${sunSideText}`"
                @input="stopPlaying"
              />
            </div>
            <span class="flight-timeline__elapsed mono" aria-label="비행 경과 시간"
              >{{ elapsed }} / {{ flight.duration }}분</span
            >
          </div>
          <div class="route-summary">
            <div role="group" aria-label="출발">
              <b class="mono"
                >{{ flight.from.code }}<small>{{ flight.from.cityLabel }}</small></b
              >
              <p>{{ departureDate }} · {{ formatTime(flight.departure, flight.from.tz) }}</p>
            </div>
            <div class="route-summary__middle">
              <span>{{ formatDuration(flight.duration) }}</span>
              <div><i /><Plane :size="17" /><i /></div>
              <span>{{ flight.distance.toLocaleString() }} km</span>
            </div>
            <div class="route-summary__arrival" role="group" aria-label="도착">
              <b class="mono"
                >{{ flight.to.code }}<small>{{ flight.to.cityLabel }}</small></b
              >
              <p>{{ arrivalDate }} · {{ formatTime(flight.arrival, flight.to.tz) }}</p>
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
      <h2 id="guide-title">이용 안내</h2>
      <button
        type="button"
        class="icon-button"
        aria-label="이용 안내 닫기"
        @click="guideDialog.close()"
      >
        <X :size="20" />
      </button>
    </div>
    <dl class="guide-details">
      <div>
        <dt>출발 시간</dt>
        <dd>출발 공항의 현지 시간 기준</dd>
      </div>
      <div>
        <dt>좌우 방향</dt>
        <dd>기수가 향하는 방향 기준</dd>
      </div>
      <div>
        <dt>햇빛 비율</dt>
        <dd>전체 비행 중 각 방향에 해가 있는 비율</dd>
      </div>
      <div>
        <dt>일출·일몰</dt>
        <dd>출발 공항 현지 시간 기준</dd>
      </div>
    </dl>
    <p class="guide-note">실제 항로·날씨에 따라 결과가 달라질 수 있습니다.</p>
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
      <h2 id="share-title">결과 공유</h2>
      <button
        type="button"
        class="icon-button"
        aria-label="결과 공유 닫기"
        @click="shareDialog.close()"
      >
        <X :size="20" />
      </button>
    </div>
    <div class="boarding-pass">
      <div class="boarding-pass__route">
        <div>
          <b class="mono">{{ flight.from.code }}</b
          ><span>{{ flight.from.cityLabel }}</span>
        </div>
        <Plane :size="26" />
        <div>
          <b class="mono">{{ flight.to.code }}</b
          ><span>{{ flight.to.cityLabel }}</span>
        </div>
      </div>
      <div class="boarding-pass__seat">
        <b
          >{{ recommendedTitle
          }}<ArrowLeft v-if="recommendedSide === 'left'" :size="20" /><ArrowRight
            v-else-if="recommendedSide === 'right'"
            :size="20" /><Check v-else :size="20"
        /></b>
      </div>
      <div v-if="sunEvents.length" class="boarding-pass__events">
        <span v-for="event in sunEvents" :key="event.instant.getTime()" :title="event.title">
          <component :is="event.icon" :size="15" />{{ event.label }}
          <time class="mono" :datetime="event.instant.toISOString()">{{ event.time }}</time>
        </span>
      </div>
      <div class="boarding-pass__bottom">
        <div aria-label="출발 현지 시간">
          <b>{{ flight.date }} · {{ flight.time }}</b>
        </div>
        <div aria-label="비행시간">
          <b>{{ formatDuration(flight.duration) }}</b>
        </div>
      </div>
    </div>
    <label class="sr-only" for="share-url">공유 링크</label
    ><input
      id="share-url"
      class="share-dialog__url mono"
      :value="sharedUrl"
      readonly
      @focus="(event) => event.target.select()"
    />
    <button type="button" class="primary-button" @click="copyLink">
      <Copy :size="16" />링크 복사
    </button>
    <button v-if="shareSupported" type="button" class="share-dialog__native" @click="nativeShare">
      <Share2 :size="15" />다른 앱으로 공유
    </button>
  </dialog>
  <Transition name="toast"
    ><div v-if="toast" class="toast-message" role="status">
      <Check :size="16" />{{ toast }}
    </div></Transition
  >
</template>
