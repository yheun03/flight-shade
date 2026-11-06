<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { MapPin, ChevronDown, Check } from '@lucide/vue'
import { translate } from '~/i18n/index.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  id: { type: String, required: true },
  airports: { type: Array, required: true },
  language: { type: String, default: 'ko' },
  loading: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  errorId: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'select', 'confirm', 'search', 'invalid'])
const t = (key, values) => translate(props.language, key, values)
const invalidDraft = ref(false)
const city = (airport) =>
  props.language === 'en' ? airport.city || airport.name : airport.cityLabel
const name = (airport) => (props.language === 'en' ? airport.name : airport.nameLabel)
const open = ref(false)
const query = ref('')
const activeIndex = ref(-1)
const input = ref(null)
let pendingConfirm = false
const selected = computed(() =>
  props.airports.find((airport) => airport.code === props.modelValue.trim().toUpperCase()),
)
const matches = computed(() => {
  const term = query.value.trim().toLowerCase()
  const popular = ['ICN', 'GMP', 'PUS', 'CJU', 'KIX', 'NRT', 'HND', 'FUK', 'SIN', 'LAX']
  if (!term)
    return popular
      .map((code) => props.airports.find((airport) => airport.code === code))
      .filter(Boolean)
  return props.airports
    .filter((airport) => airport.search.includes(term))
    .sort((a, b) => Number(b.code.toLowerCase() === term) - Number(a.code.toLowerCase() === term))
    .slice(0, 8)
})

function choose(airport, confirmed = false) {
  pendingConfirm = false
  invalidDraft.value = false
  emit('update:modelValue', airport.code)
  emit('select', airport)
  if (confirmed) emit('confirm')
  open.value = false
  input.value?.blur()
}
function focus() {
  pendingConfirm = false
  emit('search')
  invalidDraft.value = false
  open.value = true
  query.value = ''
  activeIndex.value = -1
}
function onInput(event) {
  pendingConfirm = false
  query.value = event.target.value
  emit('search')
  invalidDraft.value = false
  activeIndex.value = matches.value.length ? 0 : -1
}
function onKey(event) {
  if (event.isComposing || event.keyCode === 229) {
    if (event.key === 'Enter') event.preventDefault()
    return
  }
  if (event.key === 'Escape') {
    pendingConfirm = false
    open.value = false
    event.stopPropagation()
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    open.value = true
    if (!matches.value.length) return
    activeIndex.value =
      activeIndex.value < 0
        ? event.key === 'ArrowDown'
          ? 0
          : matches.value.length - 1
        : (activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + matches.value.length) %
          matches.value.length
    nextTick(() =>
      document
        .getElementById(`${props.id}-option-${activeIndex.value}`)
        ?.scrollIntoView({ block: 'nearest' }),
    )
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    if (!open.value) {
      emit('confirm')
      return
    }
    confirmSelection()
  }
}
function confirmSelection() {
  if (props.loading && !matches.value.length) {
    pendingConfirm = true
    return
  }
  const exact = matches.value.find((airport) => airport.code === query.value.trim().toUpperCase())
  const airport =
    activeIndex.value >= 0
      ? matches.value[activeIndex.value]
      : exact || (query.value.trim() ? matches.value[0] : selected.value)
  if (airport) choose(airport, true)
  else {
    invalidDraft.value = true
    emit('invalid')
  }
}
watch(
  () => props.loading,
  (loading) => {
    if (!loading && pendingConfirm && open.value) {
      pendingConfirm = false
      confirmSelection()
    }
  },
)
</script>

<template>
  <div
    class="airport-field"
    @focusout="
      (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          open = false
          pendingConfirm = false
        }
      }
    "
  >
    <label :for="id" class="field-label">{{ label }}</label>
    <div class="airport-field__control" :class="{ 'is-open': open }">
      <MapPin :size="18" />
      <div class="airport-field__value">
        <input
          :id="id"
          ref="input"
          :value="open ? query : modelValue"
          role="combobox"
          autocomplete="off"
          :aria-expanded="open"
          :aria-controls="open ? `${id}-list` : undefined"
          :aria-activedescendant="
            open && activeIndex >= 0 && matches[activeIndex]
              ? `${id}-option-${activeIndex}`
              : undefined
          "
          aria-autocomplete="list"
          :placeholder="t('airportPlaceholder')"
          :aria-invalid="invalid || invalidDraft"
          :aria-describedby="
            [`${id}-status`, (invalid || invalidDraft) && errorId].filter(Boolean).join(' ')
          "
          autocapitalize="characters"
          :spellcheck="false"
          required
          @focus="focus"
          @input="onInput"
          @keydown="onKey"
        />
        <span v-if="selected && !open">{{ city(selected) }} · {{ name(selected) }}</span>
      </div>
      <ChevronDown :size="16" />
    </div>
    <span :id="`${id}-status`" class="sr-only" role="status">{{
      open ? (loading ? t('loadingAirports') : t('airportCount', { count: matches.length })) : ''
    }}</span>
    <ul
      v-if="open"
      :id="`${id}-list`"
      class="airport-field__options"
      role="listbox"
      :aria-label="t('airportResults', { label })"
    >
      <li v-if="!matches.length" class="airport-field__empty" role="option" aria-disabled="true">
        {{ t(loading ? 'loadingAirports' : 'noAirports') }}
      </li>
      <li
        v-for="(airport, index) in matches"
        :id="`${id}-option-${index}`"
        :key="airport.code"
        role="option"
        :aria-selected="activeIndex === index"
        :class="{ 'is-active': activeIndex === index }"
        @mousedown.prevent="choose(airport)"
      >
        <b class="mono">{{ airport.code }}</b>
        <span
          >{{ city(airport) }}<small>{{ name(airport) }}</small></span
        >
        <Check v-if="modelValue === airport.code" :size="16" />
      </li>
    </ul>
  </div>
</template>
