<script setup>
import { h, onMounted, onUnmounted, ref, render, watch } from 'vue'
import { Focus, Minus, Plus, Navigation, Plane, Sun, Moon } from '@lucide/vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '~/assets/scss/projects/flight-shade/_map.scss'
import { routePoint } from '~/utils/geo.js'
import { translate } from '~/i18n/index.js'

const props = defineProps({
  flight: { type: Object, required: true },
  snapshot: { type: Object, required: true },
  mobile: { type: Boolean, default: false },
  topInset: { type: Number, default: 0 },
  language: { type: String, default: 'ko' },
})
const t = (key, values) => translate(props.language, key, values)
const city = (airport) =>
  props.language === 'en' ? airport.city || airport.name : airport.cityLabel
const container = ref(null)
const tileError = ref(false)
let map, routeLayer, aircraft, sunlight, sunlightLine, observer
const markerIcons = {}
let path = []

function fitRoute() {
  if (!map || !path.length) return
  const wide = !props.mobile
  map.fitBounds(L.latLngBounds(path), {
    paddingTopLeft: [
      wide ? 45 : 34,
      wide ? 65 : Math.max(0, Math.min(props.topInset || 250, container.value.clientHeight - 115)),
    ],
    paddingBottomRight: [wide ? (window.innerWidth <= 1150 ? 290 : 345) : 35, 65],
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
  L.polyline(path, {
    color: '#d8d7b5',
    weight: 2.5,
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
      color: '#f3f1e9',
      weight: 2,
      fillColor: '#213c33',
      fillOpacity: 1,
    })
      .addTo(routeLayer)
      .bindTooltip(`${airport.code} · ${city(airport)}`, {
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
    html: `<span style="transform:rotate(${point.heading - 45}deg)">${markerIcons.plane}</span>`,
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
    html: isNight ? markerIcons.moon : markerIcons.sun,
  })
  if (!sunlight) {
    sunlightLine = L.polyline([position, sunPosition], {
      color: '#de9c42',
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
  // Leaflet markers use static HTML; render the same Lucide components once.
  for (const [name, icon] of Object.entries({ plane: Plane, sun: Sun, moon: Moon })) {
    const element = document.createElement('div')
    render(h(icon, { size: 32, strokeWidth: 1.75, 'aria-hidden': true }), element)
    markerIcons[name] = element.innerHTML
    render(null, element)
  }
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
watch(() => `${props.flight.from.code}:${props.flight.to.code}`, drawRoute)
watch(() => props.language, drawRoute)
watch(() => props.mobile, fitRoute)
watch(() => props.topInset, fitRoute)
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
      :aria-label="t('mapLabel', { from: props.flight.from.code, to: props.flight.to.code })"
    />
    <div class="flight-map__compass" :aria-label="t('north')">
      <Navigation :size="16" /><span>N</span>
    </div>
    <div class="flight-map__controls">
      <button type="button" :aria-label="t('fitRoute')" :title="t('fitRoute')" @click="fitRoute">
        <Focus :size="18" />
      </button>
      <span />
      <button type="button" :aria-label="t('zoomIn')" @click="map?.zoomIn()">
        <Plus :size="18" />
      </button>
      <button type="button" :aria-label="t('zoomOut')" @click="map?.zoomOut()">
        <Minus :size="18" />
      </button>
    </div>
    <p v-if="tileError" class="flight-map__error" role="status">{{ t('mapFailed') }}</p>
  </div>
</template>
