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

const initials = computed(() => props.context.displayName?.slice(0, 1) || "V");
const loginUrl = import.meta.env.VITE_LOGIN_URL || "https://login.verdantflarehub.com/sign-in";
const logoutUrl = new URL("/logout", loginUrl).toString();
const logout = () => window.location.assign(logoutUrl);

const chooseOrganization = (org) => {
  emit("organization-change", org.organizationId);
  orgOpen.value = false;
};
</script>

<template>
  <header class="topbar">
    <button class="mobile-menu" aria-label="打开导航" @click="$emit('menu')"><AppIcon name="menu" /></button>

    <div class="topbar-spacer" />

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

    <div class="topbar-action-wrap">
      <button class="profile-button" @click="profileOpen = !profileOpen">
        <span>{{ initials }}</span><AppIcon name="chevron" :size="15" />
      </button>
      <div v-if="profileOpen" class="popover profile-popover">
        <div class="profile-summary"><span>{{ initials }}</span><div><strong>{{ context.displayName }}</strong><small>{{ context.email }}</small></div></div>
        <button @click="logout"><AppIcon name="logout" :size="16" />退出登录</button>
      </div>
    </div>
  </header>
</template>
