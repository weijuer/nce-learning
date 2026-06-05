<script name="Home" setup lang="ts">
import { useRouter } from 'vue-router'

defineOptions({
  name: 'Home'
})

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
      <button type="button" class="btn btn-secondary" @click="goGetStarted">Get Started</button>
    </header>
  </div>
</template>

<style scoped>
.home {
  place-content: center;
  height: 70%;
}
</style>
