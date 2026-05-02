<script name="Home" setup lang="ts">
import { WButton } from 'w-design-vue'
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
      <w-button type="primary" @click="goGetStarted">Get Started</w-button>
    </header>
  </div>
</template>

<style scoped>
.home {
  place-content: center;
  height: 70%;
}
</style>
