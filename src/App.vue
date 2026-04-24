<template>
  <div class="app">
    <h1 class="title">📖 新概念英语点读</h1>
    <PointReader />
  </div>
</template>

<script setup lang="ts">
import PointReader from './components/PointReader.vue'
</script>

<style scoped>
.app {
  text-align: center;
}
.title {
  margin-bottom: 1.5rem;
  color: var(--primary);
}
</style>