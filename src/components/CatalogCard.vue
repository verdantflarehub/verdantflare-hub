<script setup>
import { ref } from "vue";
import AppIcon from "./AppIcon.vue";
import { navigate } from "../router";

const iconFailed = ref(false);
defineProps({
  title: { type: String, required: true },
  meta: { type: String, default: "" },
  description: { type: String, default: "" },
  icon: { type: String, default: "market" },
  iconUrl: { type: String, default: "" },
  tags: { type: Array, default: () => [] },
  status: { type: String, required: true },
  statusTone: { type: String, default: "neutral" },
  actions: { type: Array, default: () => [] },
  highlighted: { type: Boolean, default: false },
});
</script>

<template>
  <article class="catalog-card" :class="{ 'is-highlighted': highlighted }">
    <div class="catalog-card-top">
      <span class="catalog-card-icon" aria-hidden="true"><img v-if="iconUrl && !iconFailed" :src="iconUrl" alt="" @error="iconFailed = true" /><AppIcon v-else :name="icon" :size="25" /></span>
      <div class="catalog-card-heading">
        <h3>{{ title }}</h3>
        <span v-if="meta">{{ meta }}</span>
      </div>
    </div>
    <p class="catalog-card-description">{{ description }}</p>
    <div class="catalog-card-tags">
      <span v-for="tag in tags" :key="tag">{{ tag }}</span>
    </div>
    <footer class="catalog-card-footer">
      <span class="catalog-card-status" :class="statusTone"><i aria-hidden="true" />{{ status }}</span>
      <div v-if="actions.length" class="catalog-card-actions">
        <button v-for="action in actions" :key="action.label" type="button" :class="{ primary: action.primary }" @click="navigate(action.to)">{{ action.label }}</button>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.catalog-card { min-width: 0; min-height: 246px; padding: 20px; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 8px; background: rgba(9, 13, 10, .72); transition: border-color 180ms ease, background 180ms ease, transform 180ms ease; }
.catalog-card:hover, .catalog-card:focus-within { border-color: rgba(76, 227, 154, .42); background: rgba(244, 241, 232, .045); transform: translateY(-2px); }
.catalog-card.is-highlighted { border-color: rgba(76, 227, 154, .58); box-shadow: inset 3px 0 0 var(--green); }
.catalog-card-top { min-width: 0; display: flex; align-items: center; gap: 13px; }
.catalog-card-icon { width: 46px; height: 46px; flex: 0 0 auto; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 8px; background: rgba(76, 227, 154, .07); color: var(--green); }
.catalog-card-icon img { width: 28px; height: 28px; object-fit: contain; }
.catalog-card-heading { min-width: 0; }
.catalog-card-heading h3 { margin: 0; overflow-wrap: anywhere; font-size: 17px; font-weight: 650; line-height: 1.35; letter-spacing: -.02em; }
.catalog-card-heading span { display: block; margin-top: 5px; overflow-wrap: anywhere; color: var(--muted); font-size: 11px; line-height: 1.45; }
.catalog-card-description { min-height: 41px; margin: 16px 0 18px; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; color: var(--muted-strong); font-size: 12px; line-height: 1.7; }
.catalog-card-tags { min-height: 26px; margin-top: auto; display: flex; align-items: flex-start; flex-wrap: wrap; gap: 6px; }
.catalog-card-tags span { max-width: 100%; padding: 4px 7px; border: 1px solid var(--line); border-radius: 5px; background: rgba(244, 241, 232, .035); color: var(--muted-strong); font-size: 10px; line-height: 1.4; overflow-wrap: anywhere; }
.catalog-card-footer { min-height: 42px; margin-top: 16px; padding-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid var(--line); }
.catalog-card-status { min-width: 0; display: inline-flex; align-items: center; gap: 7px; color: var(--muted); font-size: 11px; line-height: 1.35; white-space: nowrap; }
.catalog-card-status i { width: 6px; height: 6px; flex: 0 0 auto; border-radius: 50%; background: currentColor; }
.catalog-card-status.positive { color: var(--green); }
.catalog-card-status.positive i { box-shadow: 0 0 8px rgba(76, 227, 154, .4); }
.catalog-card-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 7px; }
.catalog-card-actions button { min-height: 32px; padding: 5px 10px; border: 1px solid var(--line); border-radius: 7px; background: rgba(244, 241, 232, .06); color: var(--paper); font-size: 11px; font-weight: 600; white-space: nowrap; cursor: pointer; transition: border-color 150ms ease, background 150ms ease, transform 150ms ease; }
.catalog-card-actions button:hover { border-color: var(--line-strong); background: rgba(244, 241, 232, .11); }
.catalog-card-actions button.primary { border-color: rgba(76, 227, 154, .5); background: rgba(76, 227, 154, .14); color: var(--green); }
.catalog-card-actions button.primary:hover { background: rgba(76, 227, 154, .22); }
.catalog-card-actions button:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }
.catalog-card-actions button:active { transform: translateY(1px); }
@media (max-width: 680px) { .catalog-card { min-height: 0; } }
@media (prefers-reduced-motion: reduce) { .catalog-card, .catalog-card-actions button { transition: none; }.catalog-card:hover, .catalog-card:focus-within { transform: none; } }
</style>
