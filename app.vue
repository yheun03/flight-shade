<script setup>
import DefaultLayout from '~/layouts/default.vue'
import FlightShadePage from '~/pages/index.vue'
defineProps({ initialLanguage: { type: String, default: 'ko' } })
</script>

<template>
  <DefaultLayout>
    <FlightShadePage :initial-language="initialLanguage" />
  </DefaultLayout>
</template>
