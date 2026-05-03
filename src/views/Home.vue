<script name="Home" setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goGetStarted = () => {
  router.push('/books')
}
</script>

<template>
  <div class="home">
    <header class="page-hero">
      <h1>NCE Learning</h1>
      <p>Simple · Efficient · Focus</p>
      <button type="button" class="home-btn home-btn-primary" @click="goGetStarted">
        Get Started
      </button>
    </header>
  </div>
</template>

<style scoped>
.home {
  place-content: center;
  height: 70%;

  .home-btn {
    margin: 0;
    position: relative;
    white-space: nowrap;
    font-size: var(--w-button-font-size, 1rem);
    line-height: 1;
    user-select: none;
    touch-action: manipulation;
    padding-inline: 1rem;
    padding-block: 0.5rem;
    cursor: pointer;
    -webkit-font-smoothing: antialiased;
    -webkit-tap-highlight-color: transparent;
    border: 1px solid transparent;
    border-radius: var(--w-button-border-radius, 6px);
    transition:
      outline-width 0.2s,
      transform 0.2s;

    &.home-btn-primary {
      color: #fff;
      background-color: #4827ec;
      border-color: #4827ec;

      &:hover {
        background-color: #3819a8;
        border-color: #3819a8;
      }
    }
  }
}
</style>
