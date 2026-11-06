<script setup>
import { computed, onBeforeMount, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowUpDown,
  Check,
  Clock3,
  Copy,
  Info,
  Link,
  Moon,
  Pause,
  Plane,
  Play,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
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
const fromAirport = computed(() => findAirport(from.value))
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
const recommendedTitle = computed(() =>
  recommendedSide.value === 'left'
    ? '왼쪽 창가'
    : recommendedSide.value === 'right'
      ? '오른쪽 창가'
      : '양쪽 모두 좋아요',
)
const shadePercent = computed(() => 100 - (flight.value.percentages[recommendedSide.value] || 0))
const recommendationText = computed(() =>
  flight.value.percentages.night >= 98
    ? '대부분 밤에 비행해요. 어느 쪽이든 편안하게 쉬어 가세요.'
    : recommendedSide.value === 'either'
      ? '양쪽의 햇빛 노출이 비슷해요. 마음에 드는 창가를 골라보세요.'
      : `비행 중 약 ${shadePercent.value}% 구간에서 이쪽 창가에 직접 들어오는 햇빛이 적어요.`,
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
const timeZoneLabel = computed(() => fromAirport.value?.tz || '공항을 선택해 주세요')

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
      notify('이 항공편에 맞는 창가 좌석을 찾았어요.')
    }
    sharedUrl.value = flightUrl(nextFlight, window.location.href)
    document.title = `${origin.code} → ${destination.code} · ${recommendedTitle.value} 추천 | Flight Shade`
    return true
  } catch (cause) {
    error.value = cause.message
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
    if (!submitFlight(false))
      notify('공유 정보를 확인해 주세요. 현재 지도에는 기본 항공편이 표시됩니다.')
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
    notify('같은 결과를 볼 수 있는 링크를 복사했어요.')
  } catch {
    sharedUrl.value = url
    if (!shareDialog.value.open) shareDialog.value.showModal()
    notify('링크를 선택해 직접 복사해 주세요.')
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
    if (cause.name !== 'AbortError') notify('공유 링크를 복사해 사용해 주세요.')
  }
}
function onVisibility() {
  if (document.hidden) stopPlaying()
}
onBeforeMount(loadFromUrl)
onMounted(() => {
  sharedUrl.value = flightUrl(flight.value, window.location.href)
  shareSupported.value = typeof navigator.share === 'function'
  window.addEventListener('popstate', loadFromUrl)
  document.addEventListener('visibilitychange', onVisibility)
})
onUnmounted(() => {
  stopPlaying()
  clearTimeout(toastTimer)
  window.removeEventListener('popstate', loadFromUrl)
  document.removeEventListener('visibilitychange', onVisibility)
})
watch(
  () => flight.value,
  () => {
    sharedUrl.value = flightUrl(flight.value, window.location.href)
  },
)
</script>

<template>
  <a class="skip-link" href="#flight-form">항공편 입력으로 건너뛰기</a>
  <header class="header">
    <a class="wordmark" href="./" aria-label="Flight Shade 홈"
      ><span class="wordmark__icon"><FlightShadeAircraftIcon /></span>flight<span>shade</span
      ><span class="wordmark__dot">.</span></a
    >
    <nav class="header__nav" aria-label="주 메뉴">
      <span class="header__tagline">A little less sun. A better flight.</span
      ><button type="button" @click="guideDialog.showModal()">
        이용 안내 <ArrowUpRight :size="15" />
      </button>
    </nav>
  </header>

  <main class="dashboard">
    <section class="intro" aria-labelledby="page-title">
      <div>
        <p class="eyebrow"><span /> YOUR WINDOW TO A COMFORTABLE FLIGHT</p>
        <h1 id="page-title">설레는 비행, <span>햇빛 걱정 없이.</span></h1>
        <p class="intro__description">
          비행 내내 더 편안한 쪽. 내 항공편의 그늘진 창가를 찾아보세요.
        </p>
      </div>
      <div class="intro__note">
        <span class="intro__note-icon"><Sun :size="24" /></span>
        <p>좋은 여행은<br /><b>좋은 자리에서 시작되니까.</b></p>
        <span class="intro__note-line" />
      </div>
    </section>

    <div class="workspace">
      <aside class="flight-panel">
        <form id="flight-form" class="flight-form" @submit.prevent="submitFlight()">
          <div class="flight-form__heading">
            <span class="eyebrow">LET'S FIND YOUR SIDE</span
            ><span class="flight-form__step mono">01 / 02</span>
          </div>
          <h2>어디로 떠나시나요?</h2>
          <p class="flight-form__description">항공편 정보를 입력해 주세요.</p>
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
              <label for="departure-time" class="field-label">출발 시간</label>
              <div class="field__control">
                <input id="departure-time" v-model="time" type="time" required />
              </div>
            </div>
          </div>
          <p class="flight-form__timezone">
            <Info :size="12" />출발 공항 현지 시간 기준<span>{{ timeZoneLabel }}</span>
          </p>
          <div class="field flight-form__duration">
            <label for="duration-hours" class="field-label"
              >비행시간 <span>예상 시간 · 직접 수정 가능</span></label
            >
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
          <button class="primary-button flight-form__submit" type="submit">
            <Sparkles :size="17" />그늘 좌석 찾기<ArrowRight :size="18" />
          </button>
          <p class="flight-form__hint"><ShieldCheck :size="13" />로그인 없이, 가볍게 확인하세요.</p>
        </form>
        <div class="flight-tip">
          <span class="flight-tip__icon"><Sun :size="19" /></span>
          <div>
            <b>같은 노선도, 시간에 따라 달라져요.</b>
            <p>
              태양은 움직이니까요. 출발 시간을 바꾸면<br class="desktop-break" />
              추천하는 좌석도 달라질 수 있어요.
            </p>
          </div>
        </div>
      </aside>

      <section class="flight-view" aria-label="좌석 추천 결과">
        <div class="flight-view__map-area">
          <FlightShadeMap :flight="flight" :snapshot="snapshot" />
          <article
            class="seat-card"
            :class="{ 'seat-card--either': recommendedSide === 'either' }"
            aria-live="polite"
            aria-atomic="true"
          >
            <div class="seat-card__top">
              <span><span class="live-dot" /> YOUR SHADY SIDE</span
              ><span class="seat-card__badge">추천 좌석</span>
            </div>
            <p class="seat-card__eyebrow">이번 비행은 이쪽이에요</p>
            <h2>
              <ArrowLeft v-if="recommendedSide === 'left'" :size="33" /><ArrowRight
                v-else-if="recommendedSide === 'right'"
                :size="33"
              /><Check v-else :size="29" />{{ recommendedTitle }}
            </h2>
            <p class="seat-card__description">{{ recommendationText }}</p>
            <div class="seat-diagram" aria-label="기체 진행 방향을 바라볼 때의 좌우 좌석">
              <span class="seat-diagram__direction">진행 방향 <ArrowUpRight :size="11" /></span>
              <div
                class="seat-diagram__side"
                :class="{
                  'is-recommended': recommendedSide === 'left' || recommendedSide === 'either',
                }"
              >
                <span v-for="i in 5" :key="i" /><b>{{
                  recommendedSide === 'left' || recommendedSide === 'either' ? '✓ 왼쪽' : '왼쪽'
                }}</b>
              </div>
              <FlightShadeAircraftIcon class="seat-diagram__plane" />
              <div
                class="seat-diagram__side"
                :class="{
                  'is-recommended': recommendedSide === 'right' || recommendedSide === 'either',
                }"
              >
                <span v-for="i in 5" :key="i" /><b>{{
                  recommendedSide === 'right' || recommendedSide === 'either'
                    ? '✓ 오른쪽'
                    : '오른쪽'
                }}</b>
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
            <span class="live-dot" /><span>{{ sunSideText }}</span
            ><span class="mono">{{ formatTime(snapshot.instant, flight.from.tz) }}</span>
          </div>
        </div>

        <div class="flight-timeline">
          <div class="flight-timeline__top">
            <span><Clock3 :size="13" />시간에 따른 태양 위치</span
            ><span class="flight-timeline__elapsed mono"
              >{{ elapsed }}분 / {{ flight.duration }}분</span
            >
          </div>
          <div class="flight-timeline__player">
            <button
              type="button"
              class="flight-timeline__play"
              :aria-label="playing ? '비행 시뮬레이션 일시정지' : '비행 시뮬레이션 재생'"
              @click="togglePlaying"
            >
              <Pause v-if="playing" :size="15" fill="currentColor" /><Play
                v-else
                :size="15"
                fill="currentColor"
              />
            </button>
            <div class="flight-timeline__track">
              <div class="flight-timeline__segments" aria-hidden="true">
                <span
                  v-for="(sample, index) in flight.samples"
                  :key="index"
                  :class="`is-${sample.side}`"
                />
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
            <Sun :size="17" class="flight-timeline__sun" />
          </div>
          <div class="route-summary">
            <div>
              <span>DEPARTURE</span
              ><b class="mono"
                >{{ flight.from.code }}<small>{{ flight.from.cityLabel }}</small></b
              >
              <p>{{ departureDate }} · {{ formatTime(flight.departure, flight.from.tz) }}</p>
            </div>
            <div class="route-summary__middle">
              <span>{{ formatDuration(flight.duration) }}</span>
              <div><i /><Plane :size="17" /><i /></div>
              <span>{{ flight.distance.toLocaleString() }} km</span>
            </div>
            <div class="route-summary__arrival">
              <span>ARRIVAL</span
              ><b class="mono"
                >{{ flight.to.code }}<small>{{ flight.to.cityLabel }}</small></b
              >
              <p>{{ arrivalDate }} · {{ formatTime(flight.arrival, flight.to.tz) }}</p>
            </div>
          </div>
          <p class="flight-timeline__note">출발·도착 시간은 각 공항의 현지 시간입니다.</p>
        </div>
      </section>
    </div>

    <div class="below-workspace">
      <p>
        <Info :size="13" />대권 경로와 태양 위치에 따른 예상 결과로, 실제 항로·날씨·기체 구조에 따라
        달라질 수 있어요.
      </p>
      <button type="button" @click="guideDialog.showModal()">
        어떻게 계산하나요? <ArrowUpRight :size="14" />
      </button>
    </div>
  </main>

  <footer class="footer">
    <span>© 2026 Flight Shade</span><span>Chase the journey, not the sun. <Sun :size="13" /></span
    ><a href="https://github.com/yheun03/planearby" target="_blank" rel="noopener"
      >Inspired by Planearby <ArrowUpRight :size="12"
    /></a>
  </footer>

  <dialog
    ref="guideDialog"
    class="guide-dialog"
    @click="
      (event) => {
        if (event.target === guideDialog) guideDialog.close()
      }
    "
  >
    <div class="dialog-heading">
      <span class="eyebrow">A LITTLE GUIDE</span
      ><button
        type="button"
        class="icon-button"
        aria-label="이용 안내 닫기"
        @click="guideDialog.close()"
      >
        <X :size="20" />
      </button>
    </div>
    <h2>창가에 앉기 전, 알아두세요.</h2>
    <p class="dialog-intro">좌석을 고르는 작은 기준이 되어드릴게요.</p>
    <ol class="guide-steps">
      <li>
        <span class="mono">01</span>
        <div>
          <h3>공항과 출발 시간을 입력해요.</h3>
          <p>
            IATA 공항 코드 또는 도시 이름으로 검색하세요. 출발 시간은 출발 공항의 현지 시간이며
            서머타임도 반영합니다. 서머타임 종료로 반복되는 시간은 먼저 도래하는 시간을 사용합니다.
          </p>
        </div>
      </li>
      <li>
        <span class="mono">02</span>
        <div>
          <h3>비행 경로를 따라 해를 확인해요.</h3>
          <p>
            최단 대권 경로의 240개 구간에서 태양의 방위각·고도를 계산합니다. 고도 약 10.7km에서
            보이는 지평선과 출발·도착 시 상승·하강을 근사해 야간을 구분합니다.
          </p>
        </div>
      </li>
      <li>
        <span class="mono">03</span>
        <div>
          <h3>햇빛이 더 적은 쪽을 추천해요.</h3>
          <p>
            기수가 향하는 방향을 볼 때 왼쪽과 오른쪽입니다. 숫자는 전체 비행시간 중 태양이 각 방향에
            있는 비율입니다. 태양이 기체 앞·뒤 15° 안에 있으면 앞·뒤 햇빛으로 분류합니다.
          </p>
        </div>
      </li>
    </ol>
    <div class="guide-note">
      <Info :size="17" />
      <p>
        실제 운항 항로, 구름, 기체 기울기와 창문 위치는 반영하지 않은 예상 결과입니다. 비행시간은
        거리로 추정하므로 실제 예약 항공편의 시간으로 수정하면 더 잘 맞아요.
      </p>
    </div>
    <button class="primary-button" type="button" @click="guideDialog.close()">
      알겠어요 <Check :size="16" />
    </button>
    <p class="guide-sources">
      계산
      <a href="https://github.com/mourner/suncalc/tree/v1.9.0" target="_blank" rel="noopener"
        >SunCalc</a
      >
      · 공항
      <a href="https://github.com/mwgg/Airports" target="_blank" rel="noopener">mwgg/Airports</a> ·
      참고 <a href="https://flightside.app/" target="_blank" rel="noopener">FlightSide</a>
    </p>
  </dialog>

  <dialog
    ref="shareDialog"
    class="share-dialog"
    @click="
      (event) => {
        if (event.target === shareDialog) shareDialog.close()
      }
    "
  >
    <div class="dialog-heading">
      <span class="eyebrow">YOUR FLIGHT, YOUR SIDE</span
      ><button
        type="button"
        class="icon-button"
        aria-label="결과 공유 닫기"
        @click="shareDialog.close()"
      >
        <X :size="20" />
      </button>
    </div>
    <h2>좋은 자리를 함께 나눠요.</h2>
    <p class="dialog-intro">이 링크를 열면 같은 항공편과 추천 결과를 볼 수 있어요.</p>
    <div class="boarding-pass">
      <div class="boarding-pass__top">
        <span>flight shade.</span><span>SEAT RECOMMENDATION</span>
      </div>
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
        <span>YOUR SHADY SIDE</span><b>{{ recommendedTitle }} <ArrowUpRight :size="20" /></b>
      </div>
      <div class="boarding-pass__bottom">
        <div>
          <span>DEPARTURE · LOCAL</span><b>{{ flight.date }} · {{ flight.time }}</b>
        </div>
        <div>
          <span>DURATION</span><b>{{ formatDuration(flight.duration) }}</b>
        </div>
      </div>
    </div>
    <label class="field-label" for="share-url">공유 링크</label
    ><input
      id="share-url"
      class="share-dialog__url mono"
      :value="sharedUrl"
      readonly
      @focus="(event) => event.target.select()"
    /><button type="button" class="primary-button" @click="copyLink">
      <Copy :size="16" />링크 복사하기</button
    ><button v-if="shareSupported" type="button" class="share-dialog__native" @click="nativeShare">
      <Share2 :size="15" />다른 앱으로 공유하기
    </button>
  </dialog>
  <Transition name="toast"
    ><div v-if="toast" class="toast-message" role="status">
      <Check :size="16" />{{ toast }}
    </div></Transition
  >
</template>
