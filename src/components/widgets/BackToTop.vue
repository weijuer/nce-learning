<script name="BackToTop" setup lang="ts">
const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <button @click="scrollToTop" class="back-to-top">
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 5v14"></path>
      <polyline points="6 11 12 5 18 11"></polyline>
    </svg>
  </button>
</template>

<style scoped>
.back-to-top {
  width: clamp(40px, 2.5vw, 50px);
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 200;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s linear;
  box-shadow: var(--color-shadow);
  animation: appear linear;
  animation-timeline: scroll();
  animation-range-start: cover 0%;
  animation-range-end: cover 100%;
}
</style>
