<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Focus, Minus, Plus, Navigation } from '@lucide/vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { routePoint } from '~/utils/geo.js'

const props = defineProps({
  flight: { type: Object, required: true },
  snapshot: { type: Object, required: true },
})
const container = ref(null)
const tileError = ref(false)
let map, routeLayer, aircraft, sunlight, sunlightLine, observer
const planePath =
  'M16 2c-1.1 0-1.7 1.8-1.9 3.5l-.6 6L3 18v2.5l10-3-.4 7.2-3.6 3v1.8l7-1.9 7 1.9v-1.8l-3.6-3-.4-7.2 10 3V18l-10.5-6.5-.6-6C17.7 3.8 17.1 2 16 2Z'
let path = []

function fitRoute() {
  if (!map || !path.length) return
  const wide = container.value.clientWidth > 720
  map.fitBounds(L.latLngBounds(path), {
    paddingTopLeft: [55, wide ? 95 : 80],
    paddingBottomRight: [wide ? 355 : 55, 80],
    maxZoom: 7,
    animate: false,
  })
}
function visibleLongitude(longitude, reference) {
  return longitude + Math.round((reference - longitude) / 360) * 360
}
function drawRoute() {
  if (!map) return
  routeLayer.eachLayer((layer) => layer.unbindTooltip?.())
  routeLayer.clearLayers()
  let previous = props.flight.from.lon
  path = Array.from({ length: 161 }, (_, index) => {
    const point = routePoint(props.flight.from, props.flight.to, index / 160)
    const longitude = visibleLongitude(point.lon, previous)
    previous = longitude
    return [Math.max(-85, Math.min(85, point.lat)), longitude]
  })
  L.polyline(path, { color: '#d7e9b5', weight: 8, opacity: 0.08, interactive: false }).addTo(
    routeLayer,
  )
  L.polyline(path, {
    color: '#cce5a3',
    weight: 2,
    opacity: 0.95,
    dashArray: '5 7',
    interactive: false,
  }).addTo(routeLayer)
  for (const [index, airport] of [
    [0, props.flight.from],
    [path.length - 1, props.flight.to],
  ]) {
    L.circleMarker(path[index], {
      radius: 5,
      color: '#d3e6ac',
      weight: 2,
      fillColor: '#233d35',
      fillOpacity: 1,
    })
      .addTo(routeLayer)
      .bindTooltip(`${airport.code} · ${airport.cityLabel}`, {
        permanent: true,
        direction: index === 0 ? 'top' : 'bottom',
        className: 'map-airport-label',
        offset: [0, index === 0 ? -12 : 12],
      })
  }
  fitRoute()
  drawPosition()
}
function drawPosition() {
  if (!map || !path.length) return
  const point = props.snapshot
  const reference = path[Math.min(160, Math.round(point.fraction * 160))][1]
  const longitude = visibleLongitude(point.lon, reference)
  const position = [Math.max(-85, Math.min(85, point.lat)), longitude]
  const icon = L.divIcon({
    className: 'map-aircraft',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    html: `<svg viewBox="0 0 32 32" style="transform:rotate(${point.heading}deg)" aria-hidden="true"><path d="${planePath}"/></svg>`,
  })
  if (!aircraft)
    aircraft = L.marker(position, {
      icon,
      keyboard: false,
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(map)
  else aircraft.setLatLng(position).setIcon(icon)
  const bearing = (point.azimuth * Math.PI) / 180
  const offset = Math.min(2, Math.max(0.6, props.flight.distance / 2800))
  const sunPosition = [
    Math.max(-85, Math.min(85, point.lat + Math.cos(bearing) * offset)),
    longitude + (Math.sin(bearing) * offset) / Math.max(0.2, Math.cos((point.lat * Math.PI) / 180)),
  ]
  const isNight = point.side === 'night'
  const sunIcon = L.divIcon({
    className: `map-sun${isNight ? ' is-night' : ''}`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: isNight
      ? '<span>☾</span>'
      : '<svg viewBox="0 0 40 40" aria-hidden="true"><g stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M20 2v5M20 33v5M2 20h5M33 20h5M7.3 7.3l3.5 3.5M29.2 29.2l3.5 3.5M7.3 32.7l3.5-3.5M29.2 10.8l3.5-3.5"/></g><circle cx="20" cy="20" r="8" fill="currentColor"/></svg>',
  })
  if (!sunlight) {
    sunlightLine = L.polyline([position, sunPosition], {
      color: '#efba68',
      weight: 1,
      dashArray: '3 6',
      opacity: 0.6,
      interactive: false,
    }).addTo(map)
    sunlight = L.marker(sunPosition, { icon: sunIcon, interactive: false, keyboard: false }).addTo(
      map,
    )
  } else {
    sunlight.setLatLng(sunPosition).setIcon(sunIcon)
    sunlightLine.setLatLngs([position, sunPosition]).setStyle({ opacity: isNight ? 0 : 0.6 })
  }
}
onMounted(() => {
  map = L.map(container.value, {
    zoomControl: false,
    scrollWheelZoom: false,
    attributionControl: true,
    minZoom: 2,
    maxZoom: 12,
    zoomSnap: 0.25,
  })
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)
  tiles.on('tileerror', () => {
    tileError.value = true
  })
  tiles.on('tileload', () => {
    tileError.value = false
  })
  routeLayer = L.layerGroup().addTo(map)
  observer = new ResizeObserver(() => {
    map.invalidateSize()
    fitRoute()
  })
  observer.observe(container.value)
  drawRoute()
})
watch(() => props.flight, drawRoute)
watch(() => props.snapshot, drawPosition)
onUnmounted(() => {
  observer?.disconnect()
  map?.remove()
})
</script>

<template>
  <div class="flight-map">
    <div
      ref="container"
      class="flight-map__canvas"
      role="region"
      aria-label="비행 경로와 태양 방향 지도"
    />
    <div class="flight-map__heading">
      <span class="live-dot" /> FLIGHT EXPLORER <span class="flight-map__divider" /> 비행 경로
    </div>
    <div class="flight-map__compass" aria-label="지도 위쪽은 북쪽">
      <Navigation :size="16" fill="currentColor" /><span>N</span>
    </div>
    <div class="flight-map__legend">
      <span class="flight-map__route-key" />예상 비행 경로<span class="flight-map__sun-key" />태양
      방향
    </div>
    <div class="flight-map__controls">
      <button
        type="button"
        aria-label="전체 비행 경로 보기"
        title="전체 경로 보기"
        @click="fitRoute"
      >
        <Focus :size="18" />
      </button>
      <span />
      <button type="button" aria-label="지도 확대" @click="map?.zoomIn()">
        <Plus :size="18" />
      </button>
      <button type="button" aria-label="지도 축소" @click="map?.zoomOut()">
        <Minus :size="18" />
      </button>
    </div>
    <p v-if="tileError" class="flight-map__error" role="status">
      지도 배경을 불러오지 못했습니다. 좌석 추천과 경로 계산은 정상 작동합니다.
    </p>
  </div>
</template>
