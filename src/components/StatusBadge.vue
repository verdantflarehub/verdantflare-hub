<script setup>
import { computed } from "vue";

const props = defineProps({ label: { type: String, required: true } });

const tone = computed(() => {
  if (["可用", "可调用", "正常", "有效", "成功", "已发布"].includes(props.label)) return "success";
  if (["运行中", "可体验", "灰度中", "试用中"].includes(props.label)) return "active";
  if (["失败", "已冻结"].includes(props.label)) return "danger";
  if (["许可复核", "申请体验", "待邀请"].includes(props.label)) return "warning";
  return "neutral";
});
</script>

<template><span class="status-badge" :class="tone"><i />{{ label }}</span></template>
