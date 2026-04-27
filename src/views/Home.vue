<script name="Home" setup lang="ts">
import { WHeader, WLayout, WMain, WTabs, WTab } from 'w-design-vue'
</script>

<template>
  <div class="Home">
    <w-layout class="layout-demo">
      <w-layout>
        <w-header>header</w-header>
        <w-main>
          <w-tabs variant="underline">
            <w-tab title="Tab 1" name="tab1">Content of Tab 1</w-tab>
            <w-tab title="Tab 2" name="tab2">Content of Tab 2</w-tab>
            <w-tab title="Tab 3" name="tab3">Content of Tab 3</w-tab>
          </w-tabs>
        </w-main>
      </w-layout>
    </w-layout>
  </div>
</template>

<style scoped></style>
