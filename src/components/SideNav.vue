<script setup>
import AppIcon from "./AppIcon.vue";
import { currentPath, isPathActive, navigate } from "../router";

const wwwUrl = import.meta.env.VITE_WWW_URL || "https://www.verdantflarehub.com";

defineProps({
  canManageApps: { type: Boolean, default: false },
  canManageModels: { type: Boolean, default: false },
  canManageOrganizations: { type: Boolean, default: false },
  open: { type: Boolean, default: false },
});

const emit = defineEmits(["close"]);

const groups = [
  {
    items: [
      { label: "概览", icon: "overview", href: "/", exact: true },
      { label: "模型市场", icon: "models", href: "/api/models" },
      { label: "应用市场", icon: "market", href: "/market" },
      { label: "在线体验", icon: "experience", href: "/experience" },
    ],
  },
  {
    label: "API CENTER",
    items: [
      { label: "API 密钥", icon: "key", href: "/api/keys" },
      { label: "调用示例", icon: "playground", href: "/api/playground" },
      { label: "任务与日志", icon: "tasks", href: "/api/tasks" },
      { label: "用量", icon: "usage", href: "/api/usage" },
    ],
  },
  {
    label: "组织设置",
    items: [
      { label: "组织信息", icon: "organization", href: "/settings/organization" },
      { label: "成员与角色", icon: "members", href: "/settings/members" },
      { label: "套餐与账单", icon: "billing", href: "/settings/billing" },
    ],
  },
];

const opsGroup = {
  label: "内部运营",
  items: [
    { label: "模型上架", icon: "models", href: "/ops/models" },
    { label: "应用发布", icon: "release", href: "/ops/apps" },
    { label: "客户组织", icon: "clients", href: "/ops/organizations" },
  ],
};

const select = (href) => {
  navigate(href);
  emit("close");
};
</script>

<template>
  <div v-if="open" class="sidebar-scrim" @click="$emit('close')" />
  <aside class="sidebar" :class="{ open }">
    <div class="brand-block" @click="select('/')">
      <img src="/brand/verdantflare-logo.svg" alt="" />
      <div><strong>VerdantFlare</strong><span>Hub</span></div>
    </div>

    <nav class="side-navigation" aria-label="主导航">
      <section v-for="(group, groupIndex) in groups" :key="group.label || groupIndex">
        <span v-if="group.label" class="nav-section-label">{{ group.label }}</span>
        <button
          v-for="item in group.items"
          :key="item.href"
          :class="{ active: isPathActive(item.href, item.exact) }"
          :aria-current="isPathActive(item.href, item.exact) ? 'page' : undefined"
          @click="select(item.href)"
        >
          <AppIcon :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </button>
      </section>

      <section v-if="canManageApps || canManageModels || canManageOrganizations">
        <span class="nav-section-label">{{ opsGroup.label }}</span>
        <button
          v-for="item in opsGroup.items.filter((entry) => entry.href === '/ops/models' ? canManageModels : entry.href === '/ops/apps' ? canManageApps : canManageOrganizations)"
          :key="item.href"
          :class="{ active: isPathActive(item.href) }"
          @click="select(item.href)"
        >
          <AppIcon :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
          <span class="internal-dot" title="内部页面" />
        </button>
      </section>
    </nav>

    <a class="www-link" :href="wwwUrl" target="_blank" rel="noreferrer">
      <span><strong>VerdantFlare WWW</strong><small>浏览产品与公开文档</small></span>
      <AppIcon name="external" :size="16" />
    </a>
  </aside>
</template>
