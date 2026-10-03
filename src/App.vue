<script setup>
import { computed, onMounted, ref } from "vue";
import { controlApi, getCenterContext } from "./api/control";
import AppIcon from "./components/AppIcon.vue";
import SideNav from "./components/SideNav.vue";
import TopBar from "./components/TopBar.vue";
import { currentPath, currentSearch, navigate } from "./router";
import ApiView from "./views/ApiView.vue";
import ExperienceView from "./views/ExperienceView.vue";
import MarketView from "./views/MarketView.vue";
import NotFoundView from "./views/NotFoundView.vue";
import OrganizationDetailView from "./views/OrganizationDetailView.vue";
import OperationsView from "./views/OperationsView.vue";
import OverviewView from "./views/OverviewView.vue";
import ReleaseDetailView from "./views/ReleaseDetailView.vue";
import SessionDetailView from "./views/SessionDetailView.vue";
import SettingsView from "./views/SettingsView.vue";

const loginUrl = import.meta.env.VITE_LOGIN_URL || "https://login.verdantflarehub.com/sign-in";
const logoutUrl = new URL("/logout", loginUrl).toString();

const context = ref(null);
const loading = ref(true);
const error = ref("");
const sidebarOpen = ref(false);
const toast = ref("");
let toastTimer;

const activeOrganization = computed(() => {
  if (!context.value) return null;
  return context.value.organizations.find((org) => org.organizationId === context.value.activeOrganizationId) || context.value.organizations[0];
});

const isInternal = computed(() =>
  activeOrganization.value?.roles.some((role) => ["app_ops_admin", "customer_success_admin"].includes(role)),
);

const route = computed(() => {
  const path = currentPath.value;
  if (path === "/") return { component: OverviewView, area: "overview" };
  if (path === "/market" || path.startsWith("/market/apps/")) return { component: MarketView, area: "market" };
  if (path.startsWith("/experience/sessions/")) return { component: SessionDetailView, area: "experience" };
  if (path === "/experience") return { component: ExperienceView, area: "experience" };
  if (path.startsWith("/api/")) return { component: ApiView, area: "api" };
  if (path.startsWith("/settings/")) return { component: SettingsView, area: "settings" };
  if (path.startsWith("/ops/apps/") && path.endsWith("/releases") && isInternal.value) return { component: ReleaseDetailView, area: "operations" };
  if (path.startsWith("/ops/organizations/") && isInternal.value) return { component: OrganizationDetailView, area: "operations" };
  if (path.startsWith("/ops/") && isInternal.value) return { component: OperationsView, area: "operations" };
  return { component: NotFoundView, area: "not-found" };
});

const loadContext = async () => {
  context.value = null;
  loading.value = true;
  error.value = "";
  try {
    context.value = await getCenterContext();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Center Context 加载失败";
  } finally {
    loading.value = context.value === null && !error.value;
  }
};

const changeOrganization = async (organizationId) => {
  try {
    context.value = await controlApi.setActiveOrganization(organizationId);
    showToast("组织已切换，权限与额度已刷新");
    navigate("/");
  } catch {
    showToast("组织切换失败，请稍后重试");
  }
};

const showToast = (message) => {
  toast.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.value = ""), 2600);
};

onMounted(loadContext);
</script>

<template>
  <div v-if="loading" class="context-state loading-state">
    <img src="/brand/verdantflare-logo.svg" alt="VerdantFlare" />
    <div class="loading-ring" />
    <strong>正在建立安全会话</strong>
    <span>验证登录状态并加载组织权益…</span>
  </div>

  <div v-else-if="error" class="context-state error-state">
    <div class="state-icon"><AppIcon name="warning" :size="28" /></div>
    <h1>暂时无法进入 Hub</h1>
    <p>我们没有取得最新的 Center Context，因此不会使用旧权限开放业务操作。</p>
    <div class="state-detail"><span>服务状态</span><strong>{{ error }}</strong></div>
    <div class="state-actions">
      <button class="button primary" @click="loadContext">重新尝试</button>
      <a class="button secondary" :href="logoutUrl">退出登录</a>
    </div>
  </div>

  <div v-else class="hub-shell">
    <SideNav :internal="isInternal" :open="sidebarOpen" @close="sidebarOpen = false" />
    <TopBar
      :context="context"
      :active-organization="activeOrganization"
      @organization-change="changeOrganization"
      @menu="sidebarOpen = true"
    />
    <main class="hub-main">
      <Transition name="view" mode="out-in">
        <component
          :is="route.component"
          :key="`${currentPath}${currentSearch}`"
          :path="currentPath"
          :query="currentSearch"
          :organization="activeOrganization"
          :internal="isInternal"
          @toast="showToast"
        />
      </Transition>
    </main>
  </div>

  <Transition name="toast">
    <div v-if="toast" class="toast-message"><AppIcon name="check" :size="17" />{{ toast }}</div>
  </Transition>
</template>
