<script setup lang="ts">
const route = useRoute()
const TAB_PATHS = ['/', '/calendar', '/list', '/settings']
const showTabs = computed(() => TAB_PATHS.includes(route.path))
</script>

<template>
  <NuxtPage />
  <TabBar v-if="showTabs" />
</template>
