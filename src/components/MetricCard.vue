<script setup>
import AppIcon from "./AppIcon.vue";

defineProps({
  label: { type: String, required: true },
  value: { type: String, required: true },
  detail: { type: String, default: "" },
  icon: { type: String, default: "overview" },
  tone: { type: String, default: "mint" },
});
</script>

<template>
  <article class="metric-card">
    <div class="metric-icon" :class="tone"><AppIcon :name="icon" :size="19" /></div>
    <div>
      <span>{{ label }}</span>
      <strong>{{ value }}</strong>
      <small>{{ detail }}</small>
    </div>
  </article>
</template>
