<script setup>
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";

const props = defineProps({
  context: { type: Object, required: true },
  activeOrganization: { type: Object, required: true },
});

const emit = defineEmits(["organization-change", "menu"]);
const orgOpen = ref(false);
const profileOpen = ref(false);
const notificationsOpen = ref(false);

const initials = computed(() => props.context.displayName?.slice(0, 1) || "V");

const chooseOrganization = (org) => {
  emit("organization-change", org.organizationId);
  orgOpen.value = false;
};
</script>

<template>
  <header class="topbar">
    <button class="mobile-menu" aria-label="打开导航" @click="$emit('menu')"><AppIcon name="menu" /></button>

    <div class="org-switcher-wrap">
      <button class="org-switcher" @click="orgOpen = !orgOpen">
        <span class="org-avatar">{{ activeOrganization.shortName }}</span>
        <span><small>当前组织</small><strong>{{ activeOrganization.name }}</strong></span>
        <AppIcon name="chevron" :size="16" />
      </button>
      <div v-if="orgOpen" class="popover org-popover">
        <span class="popover-label">切换组织</span>
        <button
          v-for="org in context.organizations"
          :key="org.organizationId"
          :class="{ selected: org.organizationId === activeOrganization.organizationId }"
          @click="chooseOrganization(org)"
        >
          <span class="org-avatar small">{{ org.shortName }}</span>
          <span><strong>{{ org.name }}</strong><small>{{ org.plan }} · 权益 v{{ org.entitlementVersion }}</small></span>
          <AppIcon v-if="org.organizationId === activeOrganization.organizationId" name="check" :size="16" />
        </button>
      </div>
    </div>

    <div class="topbar-spacer" />
    <div class="quota-summary">
      <span><i class="quota-dot mint" />体验额度 <strong>{{ activeOrganization.experienceCredits }}</strong></span>
      <span><i class="quota-dot amber" />API 点数 <strong>{{ activeOrganization.apiCredits.toLocaleString() }}</strong></span>
    </div>

    <div class="topbar-action-wrap">
      <button class="icon-button notification-button" aria-label="通知" @click="notificationsOpen = !notificationsOpen">
        <AppIcon name="bell" :size="19" />
        <i />
      </button>
      <div v-if="notificationsOpen" class="popover notifications-popover">
        <div class="popover-head"><strong>通知</strong><span>2 条未读</span></div>
        <button><i class="notice-mark mint" /><span><strong>体验 Session 即将到期</strong><small>ComfyUI Studio 将在 42 分钟后自动关闭。</small></span></button>
        <button><i class="notice-mark amber" /><span><strong>本月 API 用量达到 68%</strong><small>可在用量页查看模型分布与预算趋势。</small></span></button>
      </div>
    </div>

    <div class="topbar-action-wrap">
      <button class="profile-button" @click="profileOpen = !profileOpen">
        <span>{{ initials }}</span><AppIcon name="chevron" :size="15" />
      </button>
      <div v-if="profileOpen" class="popover profile-popover">
        <div class="profile-summary"><span>{{ initials }}</span><div><strong>{{ context.displayName }}</strong><small>{{ context.email }}</small></div></div>
        <button><AppIcon name="members" :size="16" />个人资料</button>
        <button><AppIcon name="logout" :size="16" />退出登录</button>
      </div>
    </div>
  </header>
</template>
