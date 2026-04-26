<template>
  <router-view v-slot="{ Component }">
    <transition name="fade">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<script setup lang="ts"></script>

<style scoped>
.app {
  text-align: center;
}
.title {
  margin-bottom: 1.5rem;
  color: var(--primary);
}
</style>
