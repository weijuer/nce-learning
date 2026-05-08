<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const error = ref<Error | null>(null)
const errorInfo = ref<any>(null)

onErrorCaptured((err: Error, _, info) => {
  error.value = err
  errorInfo.value = info
  return false
})

const resetError = () => {
  error.value = null
  errorInfo.value = null
}
</script>

<template>
  <template v-if="error">
    <div class="error-boundary">
      <div class="error-card">
        <div class="error-icon">⚠️</div>
        <h3>Oops! 发生了错误</h3>
        <p class="error-message">{{ error.message }}</p>
        <button class="retry-btn" @click="resetError">重新加载</button>
      </div>
    </div>
  </template>

  <slot v-else />
</template>

<style scoped>
.error-boundary {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
}

.error-card {
  background: white;
  border-radius: 16px;
  padding: 3rem;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  max-width: 420px;
  width: 100%;
}

.error-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
}

h3 {
  font-family: 'Playfair Display', serif;
  font-size: 1.5rem;
  color: #2d3748;
  margin-bottom: 0.75rem;
}

.error-message {
  color: #718096;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.retry-btn {
  background: linear-gradient(135deg, #2c5530 0%, #4a7c59 100%);
  color: white;
  border: none;
  padding: 0.875rem 2.5rem;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(44, 85, 48, 0.3);
  }
}
</style>
