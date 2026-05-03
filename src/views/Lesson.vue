<script name="Lesson" setup lang="ts">
import { computed } from 'vue'
import { Player } from 'Widgets'

const props = defineProps({
  name: {
    type: String,
    default: ''
  },
  version: {
    type: String,
    default: ''
  }
})

const title = computed(() => {
  return props.name.split('－')[1]
})

const description = computed(() => {
  const versions = {
    NCE1: '新概念英语（一）',
    NCE2: '新概念英语（二）',
    NCE3: '新概念英语（三）',
    NCE4: '新概念英语（四）'
  }

  return `${versions[props.version as keyof typeof versions]}· MP3 同步字幕版（美音）`
})
</script>

<template>
  <div class="Lesson">
    <header class="page-hero">
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </header>
    <Player :name="name" :version="version" />
  </div>
</template>
