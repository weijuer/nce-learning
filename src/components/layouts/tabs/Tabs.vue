<script setup lang="ts">
import { type Ref, computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import type { Tab } from './Tab.vue'

const props = defineProps({
  modelValue: {
    type: Number,
    default: 0
  },
  variant: {
    type: String as () => 'default' | 'pills' | 'underline' | 'cards',
    default: 'default',
    validator: (value: string) => ['default', 'pills', 'underline', 'cards'].includes(value)
  },
  position: {
    type: String as () => 'top' | 'bottom' | 'left' | 'right',
    default: 'top'
  },
  grow: {
    type: Boolean,
    default: false
  },
  centered: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

export interface TabsProvider {
  activeIndex: Ref<number>
  tabs: Ref<Tab[]>
  registerTab: (tab: Tab) => void
  unregisterTab: (tabName: string) => void
}

const activeIndex = ref(props.modelValue)
const headerRef = ref<HTMLElement | null>(null)
const tabButtonsRef = ref<any[]>([])
const tabs = ref<Tab[]>([])
const sliderStyle = ref({})
const showSlider = ref(false)

const tabClass = computed(() => {
  const { variant, position } = props
  return [variant ? `w-tabs--${variant}` : '', position ? `w-tabs--${position}` : '']
})

// 导航栏样式
const navStyle = computed(() => ({
  justifyContent: props.centered ? 'center' : 'flex-start'
}))

// 监听modelValue变化
watch(
  () => props.modelValue,
  newValue => {
    activeIndex.value = newValue
    updateSliderPosition()
  }
)

// 监听activeIndex变化
watch(activeIndex, newValue => {
  emit('update:modelValue', newValue)
  updateSliderPosition()
})

function setActiveTab(index: number) {
  if (tabs.value[index] && !tabs.value[index].disabled) {
    activeIndex.value = index
    emit('change', tabs.value[index].name, index)
  }
}

// 更新滑块位置
async function updateSliderPosition() {
  await nextTick()

  if (!['pills', 'underline'].includes(props.variant) || !tabButtonsRef.value.length) return

  const activeTab = tabButtonsRef.value[activeIndex.value]
  if (!activeTab) return

  const header = headerRef.value
  if (!header) return

  const headerRect = header.getBoundingClientRect()
  const tabRect = activeTab.getBoundingClientRect()

  // 计算header的padding和border偏移量
  const headerStyle = window.getComputedStyle(header)
  const paddingLeft = Number.parseFloat(headerStyle.paddingLeft) || 0
  const borderLeftWidth = Number.parseFloat(headerStyle.borderLeftWidth) || 0

  sliderStyle.value = {
    width: `${tabRect.width}px`,
    height: props.variant === 'pills' ? `${tabRect.height}px` : undefined,
    transform: `translateX(${tabRect.left - headerRect.left - paddingLeft - borderLeftWidth}px )`
  }

  showSlider.value = true
}

provide('w-tabs', {
  activeIndex,
  tabs,
  registerTab: (tab: Tab) => {
    tabs.value.push(tab)
  },
  unregisterTab: (tabName: string) => {
    const index = tabs.value.findIndex(tab => tab.name === tabName)
    if (index !== -1) {
      tabs.value.splice(index, 1)
    }
  }
})

// 初始化
onMounted(() => {
  updateSliderPosition()
  window.addEventListener('resize', updateSliderPosition)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateSliderPosition)
})
</script>

<template>
  <div class="w-tabs" :class="tabClass">
    <div ref="headerRef" class="w-tabs__header">
      <div class="w-tabs__nav" :style="navStyle">
        <button
          v-for="(tab, index) in tabs"
          :key="index"
          ref="tabButtonsRef"
          class="w-tab-button"
          :class="{ active: activeIndex === index, disabled: tab.disabled }"
          @click="setActiveTab(index)"
        >
          <slot v-if="tab.icon" name="icon">
            <i :class="tab.icon" />
          </slot>
          {{ tab.title }}
        </button>
        <div
          v-if="showSlider && ['pills', 'underline'].includes(variant)"
          class="w-tab__slider"
          :style="sliderStyle"
        />
      </div>
    </div>
    <div class="w-tabs__content">
      <slot />
    </div>
  </div>
</template>

<style scoped></style>
