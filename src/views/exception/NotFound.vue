<script setup lang="ts">
defineOptions({
  name: 'NotFound'
})
</script>

<template>
  <section class="app-page exception">
    <h1>404</h1>
    <p>页面走丢了</p>
    <button type="button" @click="$router.push('/')">返回主页</button>
  </section>
</template>

<style scoped>
.exception {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  h1 {
    font-size: 80px;
    color: #404040;
    font-weight: 700;
    margin-bottom: 10px;
  }

  p {
    color: #707070;
    font-size: 20px;
    margin-bottom: 40px;
  }

  button {
    margin-top: 20px;
  }
}

@media (max-width: 500px) {
  .exception {
    h1 {
      font-size: 40px;
    }

    p {
      font-size: 14px;
    }
  }
}
</style>
