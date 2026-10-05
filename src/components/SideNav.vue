<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import { isPathActive, navigate } from "../router";

const wwwUrl = import.meta.env.VITE_WWW_URL || "https://www.verdantflarehub.com";
const loginUrl = import.meta.env.VITE_LOGIN_URL || "https://login.verdantflarehub.com/sign-in";
const logoutUrl = new URL("/logout", loginUrl).toString();
const props = defineProps({
  context: { type: Object, required: true },
  activeOrganization: { type: Object, required: true },
  canManageApps: { type: Boolean, default: false },
  canManageModels: { type: Boolean, default: false },
  canManageOrganizations: { type: Boolean, default: false },
});
const emit = defineEmits(["organization-change"]);
const orgOpen = ref(false);
const profileOpen = ref(false);
const initials = computed(() => props.context.displayName?.slice(0, 2) || "VF");
const orgInitials = computed(() => props.activeOrganization.shortName || props.activeOrganization.name?.slice(0, 1) || "组");
const groups = [
  { label: "工作空间", items: [
    { label: "工作台", icon: "overview", href: "/", exact: true },
    { label: "模型市场", icon: "models", href: "/api/models" },
    { label: "应用市场", icon: "market", href: "/market" },
    { label: "在线体验", icon: "experience", href: "/experience" },
  ] },
  { label: "API CENTER", items: [
    { label: "API 密钥", icon: "key", href: "/api/keys" },
    { label: "调用示例", icon: "playground", href: "/api/playground" },
    { label: "任务与日志", icon: "tasks", href: "/api/tasks" },
    { label: "用量", icon: "usage", href: "/api/usage" },
  ] },
  { label: "组织设置", items: [
    { label: "组织信息", icon: "organization", href: "/settings/organization" },
    { label: "成员与角色", icon: "members", href: "/settings/members" },
    { label: "套餐与账单", icon: "billing", href: "/settings/billing" },
  ] },
];
const opsItems = computed(() => [
  props.canManageModels && { label: "模型上架", icon: "models", href: "/ops/models" },
  props.canManageApps && { label: "应用发布", icon: "release", href: "/ops/apps" },
  props.canManageOrganizations && { label: "客户组织", icon: "clients", href: "/ops/organizations" },
].filter(Boolean));
const closeMenus = () => { orgOpen.value = false; profileOpen.value = false; };
const select = (href) => { closeMenus(); navigate(href); };
const chooseOrganization = (org) => { closeMenus(); emit("organization-change", org.organizationId); };
const onDocumentPointer = (event) => { if (!event.target.closest(".side-context-wrap")) closeMenus(); };
const onDocumentKey = (event) => { if (event.key === "Escape") closeMenus(); };
onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointer);
  document.addEventListener("keydown", onDocumentKey);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointer);
  document.removeEventListener("keydown", onDocumentKey);
});
</script>

<template>
  <aside class="sidebar hub-side">
    <button class="brand-block" aria-label="前往 Hub 工作台" @click="select('/')">
      <img src="/brand/verdantflare-logo.png" alt="" />
      <span class="brand-copy"><strong>VerdantFlare</strong><small>HUB</small></span>
    </button>
    <button class="side-primary" title="开始在线体验" @click="select('/experience')">
      <AppIcon name="plus" :size="17" /><span>开始在线体验</span>
    </button>
    <nav class="side-navigation" aria-label="Hub 主导航">
      <section v-for="group in groups" :key="group.label">
        <span class="nav-section-label">{{ group.label }}</span>
        <button v-for="item in group.items" :key="item.href" :class="{ active: isPathActive(item.href, item.exact) }" :aria-current="isPathActive(item.href, item.exact) ? 'page' : undefined" :title="item.label" @click="select(item.href)">
          <AppIcon :name="item.icon" :size="18" /><span class="nav-copy">{{ item.label }}</span>
        </button>
      </section>
      <section v-if="opsItems.length">
        <span class="nav-section-label">内部运营</span>
        <button v-for="item in opsItems" :key="item.href" :class="{ active: isPathActive(item.href) }" :aria-current="isPathActive(item.href) ? 'page' : undefined" :title="item.label" @click="select(item.href)">
          <AppIcon :name="item.icon" :size="18" /><span class="nav-copy">{{ item.label }}</span><span class="internal-dot" title="内部页面" />
        </button>
      </section>
    </nav>
    <div class="side-bottom">
      <div class="side-context-wrap">
        <button class="side-context" :aria-expanded="orgOpen" aria-label="切换组织" :title="activeOrganization.name" @click="orgOpen = !orgOpen; profileOpen = false">
          <span class="side-emblem">{{ orgInitials }}</span><span class="side-context-copy"><strong>{{ activeOrganization.name }}</strong><small>当前组织</small></span><AppIcon name="chevron" :size="15" />
        </button>
        <div v-if="orgOpen" class="popover org-popover side-popover">
          <span class="popover-label">切换组织</span>
          <button v-for="org in context.organizations" :key="org.organizationId" :class="{ selected: org.organizationId === activeOrganization.organizationId }" @click="chooseOrganization(org)">
            <span class="org-avatar small">{{ org.shortName || org.name?.slice(0, 1) }}</span><span><strong>{{ org.name }}</strong><small>{{ org.plan }} · 权益 v{{ org.entitlementVersion }}</small></span><AppIcon v-if="org.organizationId === activeOrganization.organizationId" name="check" :size="16" />
          </button>
        </div>
      </div>
      <div class="side-context-wrap">
        <button class="side-context side-user" :aria-expanded="profileOpen" aria-label="用户菜单" :title="context.displayName" @click="profileOpen = !profileOpen; orgOpen = false">
          <span class="side-emblem">{{ initials }}</span><span class="side-context-copy"><strong>{{ context.displayName }}</strong><small>登录身份</small></span><AppIcon name="chevron" :size="15" />
        </button>
        <div v-if="profileOpen" class="popover profile-popover side-popover">
          <div class="profile-summary"><span>{{ initials }}</span><div><strong>{{ context.displayName }}</strong><small>{{ context.email }}</small></div></div>
          <a :href="logoutUrl"><AppIcon name="logout" :size="16" />退出登录</a>
        </div>
      </div>
      <a class="side-help" :href="wwwUrl" target="_blank" rel="noreferrer" title="帮助与产品说明"><AppIcon name="external" :size="16" /><span>帮助与产品说明</span></a>
    </div>
  </aside>
</template>
