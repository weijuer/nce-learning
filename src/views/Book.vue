<script name="book" setup lang="ts">
import { ref } from 'vue'
import { WTabs, WTab, WCard } from 'w-design-vue'
import { NCE_JSON } from '@/utils/nce-data'

const books = ref(NCE_JSON || {})

const getLessonTitle = (fileName: string) => {
  return 'Lesson ' + fileName.split('－')[0]
}

console.log(NCE_JSON)
</script>

<template>
  <div class="book">
    <header>
      <h1>NCE Learning</h1>
      <p>Simple · Efficient · Focus</p>
    </header>

    <w-tabs variant="pills">
      <w-tab
        v-for="(folder, folderName) in books"
        :key="folderName"
        :title="folderName"
        :name="folderName"
      >
        <div class="lesssons">
          <div v-for="(course, courseName) in folder" :key="courseName" class="lesson">
            <div class="lesson-title">{{ getLessonTitle(course.fileName) }}</div>
            <div class="lesson-name">{{ course.name }}</div>
          </div>
        </div>
      </w-tab>
    </w-tabs>
  </div>
</template>

<style>
.book {
  padding: 2rem;
  display: flex;
  flex-direction: column;

  header {
    margin-bottom: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;

    h1 {
      font-size: 2.5rem;
      font-weight: 600;
    }
  }

  .lesssons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    grid-gap: 1rem;
    justify-content: center;

    .lesson {
      padding: 1rem;
      position: relative;
      display: flex;
      justify-content: space-between;
      flex-direction: column;
      background-color: var(--surface);
      border-radius: 10px;
      border: 1px solid var(--border);
      transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      overflow: hidden;

      &:hover {
        transform: scale(1.02);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
        border-color: var(--border);
      }

      .lesson-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text);
      }

      .lesson-name {
        font-size: 0.95rem;
        color: var(--secondary-text);
      }
    }
  }
}
</style>
