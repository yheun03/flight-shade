<script setup>
import { computed, nextTick, ref } from 'vue'
import { MapPin, ChevronDown, Check } from '@lucide/vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  id: { type: String, required: true },
  airports: { type: Array, required: true },
})
const emit = defineEmits(['update:modelValue', 'select'])
const open = ref(false)
const query = ref('')
const activeIndex = ref(-1)
const input = ref(null)
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

function choose(airport) {
  emit('update:modelValue', airport.code)
  emit('select', airport)
  open.value = false
  input.value?.blur()
}
function focus() {
  open.value = true
  query.value = ''
  activeIndex.value = -1
}
function onInput(event) {
  query.value = event.target.value
  emit('update:modelValue', event.target.value)
  activeIndex.value = -1
}
function onKey(event) {
  if (event.key === 'Escape') {
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
  if (
    event.key === 'Enter' &&
    open.value &&
    activeIndex.value >= 0 &&
    matches.value[activeIndex.value]
  ) {
    event.preventDefault()
    choose(matches.value[activeIndex.value])
  }
}
</script>

<template>
  <div
    class="airport-field"
    @focusout="
      (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) open = false
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
          :aria-controls="`${id}-list`"
          :aria-activedescendant="activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined"
          aria-autocomplete="list"
          placeholder="공항 코드 또는 도시"
          required
          @focus="focus"
          @input="onInput"
          @keydown="onKey"
        />
        <span v-if="selected && !open">{{ selected.cityLabel }} · {{ selected.nameLabel }}</span>
      </div>
      <ChevronDown :size="16" />
    </div>
    <ul
      v-if="open"
      :id="`${id}-list`"
      class="airport-field__options"
      role="listbox"
      :aria-label="`${label} 검색 결과`"
    >
      <li v-if="!matches.length" class="airport-field__empty">검색 결과가 없습니다.</li>
      <li
        v-for="(airport, index) in matches"
        :id="`${id}-option-${index}`"
        :key="airport.code"
        role="option"
        :aria-selected="modelValue === airport.code"
        :class="{ 'is-active': activeIndex === index }"
        @mousedown.prevent="choose(airport)"
      >
        <b class="mono">{{ airport.code }}</b>
        <span
          >{{ airport.cityLabel }}<small>{{ airport.nameLabel }}</small></span
        >
        <Check v-if="modelValue === airport.code" :size="16" />
      </li>
    </ul>
  </div>
</template>
