<script setup>
import { computed, ref, watch } from "vue";
import { controlApi, getCenterContext } from "./api/control";
import AppIcon from "./components/AppIcon.vue";
import SideNav from "./components/SideNav.vue";
import { currentPath, currentSearch, navigate } from "./router";
import ApiView from "./views/ApiView.vue";
import ExperienceView from "./views/ExperienceView.vue";
import GuestHubView from "./views/GuestHubView.vue";
import MarketView from "./views/MarketView.vue";
import NotFoundView from "./views/NotFoundView.vue";
import OrganizationDetailView from "./views/OrganizationDetailView.vue";
import OperationsView from "./views/OperationsView.vue";
import ModelCatalogAdminView from "./views/ModelCatalogAdminView.vue";
import OverviewView from "./views/OverviewView.vue";
import ReleaseDetailView from "./views/ReleaseDetailView.vue";
import SessionDetailView from "./views/SessionDetailView.vue";
import SettingsView from "./views/SettingsView.vue";
import SurveyView from "./views/SurveyView.vue";
import SurveyAdminView from "./views/SurveyAdminView.vue";
import { surveyPath, surveyAdminPath } from "./api/survey";
import { theme, toggleTheme } from "./theme";

const loginUrl = import.meta.env.VITE_LOGIN_URL || "https://login.verdantflarehub.com/sign-in";
const logoutUrl = new URL("/logout", loginUrl).toString();

const context = ref(null);
const loading = ref(true);
const error = ref("");
const guestMode = ref(false);
const toast = ref("");
let toastTimer;

const activeOrganization = computed(() => {
  if (!context.value) return null;
  return context.value.organizations.find((org) => org.organizationId === context.value.activeOrganizationId) || context.value.organizations[0];
});

const canManageApps = computed(() => activeOrganization.value?.roles?.includes("app_ops_admin") || false);
const canManageModels = computed(() => activeOrganization.value?.roles?.includes("api_ops_admin") || false);
const canManageOrganizations = computed(() => activeOrganization.value?.roles?.includes("customer_success_admin") || false);
const publicSurvey = computed(() => currentPath.value === surveyPath);

const route = computed(() => {
  const path = currentPath.value;
  if (path === surveyAdminPath && canManageOrganizations.value && activeOrganization.value?.organizationId === "org_verdantflare") return { component: SurveyAdminView, area: "operations" };
  if (path === "/") return { component: OverviewView, area: "overview" };
  if (path === "/market" || path.startsWith("/market/apps/")) return { component: MarketView, area: "market" };
  if (path.startsWith("/experience/sessions/")) return { component: SessionDetailView, area: "experience" };
  if (path === "/experience") return { component: ExperienceView, area: "experience" };
  if ((path === "/ops/models" || path.startsWith("/ops/models/")) && canManageModels.value) return { component: ModelCatalogAdminView, area: "operations" };
  if (path.startsWith("/api/")) return { component: ApiView, area: "api" };
  if (path.startsWith("/settings/")) return { component: SettingsView, area: "settings" };
  if (path.startsWith("/ops/apps/") && path.endsWith("/releases") && canManageApps.value) return { component: ReleaseDetailView, area: "operations" };
  if (path.startsWith("/ops/organizations/") && canManageOrganizations.value) return { component: OrganizationDetailView, area: "operations" };
  if (path === "/ops/apps" && canManageApps.value) return { component: OperationsView, area: "operations" };
  if (path === "/ops/organizations" && canManageOrganizations.value) return { component: OperationsView, area: "operations" };
  return { component: NotFoundView, area: "not-found" };
});

const loadContext = async () => {
  context.value = null;
  loading.value = true;
  error.value = "";
  guestMode.value = false;
  try {
    context.value = await getCenterContext();
  } catch (cause) {
    if (cause?.status === 403 && cause?.code === "center_user_not_found") {
      guestMode.value = true;
    } else {
      error.value = cause instanceof Error ? cause.message : "Center Context 加载失败";
    }
  } finally {
    loading.value = context.value === null && !error.value && !guestMode.value;
  }
};

const refreshContext = async () => {
  try {
    context.value = await getCenterContext();
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : "组织上下文刷新失败");
  }
};

const changeOrganization = async (organizationId, stayOnPage = false) => {
  try {
    context.value = await controlApi.setActiveOrganization(organizationId);
    showToast("组织已切换，目录与权限已刷新");
    if (!stayOnPage) navigate("/");
  } catch {
    showToast("组织切换失败，请稍后重试");
  }
};

const showToast = (message) => {
  toast.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.value = ""), 2600);
};

watch(publicSurvey, (isPublic) => { if (!isPublic) loadContext(); }, { immediate: true });
</script>

<template>
  <button
    class="hub-theme-toggle"
    type="button"
    :aria-label="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
    :title="theme === 'dark' ? '浅色模式' : '深色模式'"
    :aria-pressed="theme === 'light'"
    @click="toggleTheme"
  >
    <svg v-if="theme === 'dark'" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
    <svg v-else aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.98 13.1A9 9 0 0 1 10.9 3.02 9 9 0 1 0 20.98 13.1Z" /></svg>
    <span>{{ theme === 'dark' ? '浅色' : '深色' }}</span>
  </button>
  <SurveyView v-if="publicSurvey" />
  <div v-else-if="loading" class="context-state loading-state">
    <img src="/brand/verdantflare-logo.png" alt="VerdantFlare" />
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

  <GuestHubView v-else-if="guestMode || !activeOrganization" :path="currentPath" :logout-url="logoutUrl" @retry-context="loadContext" />

  <div v-else class="hub-shell">
    <SideNav
      :can-manage-apps="canManageApps"
      :can-manage-models="canManageModels"
      :can-manage-organizations="canManageOrganizations"
      :context="context"
      :active-organization="activeOrganization"
      @organization-change="changeOrganization"
    />
    <main class="hub-main">
      <Transition name="view" mode="out-in">
        <component
          :is="route.component"
          :key="`${activeOrganization.organizationId}:${currentPath}${currentSearch}`"
          :path="currentPath"
          :query="currentSearch"
          :organization="activeOrganization"
          :organizations="context.organizations"
          :internal="canManageApps || canManageOrganizations"
          @toast="showToast"
          @context-change="refreshContext"
          @switch-organization="(id) => changeOrganization(id, true)"
        />
      </Transition>
    </main>
  </div>

  <Transition name="toast">
    <div v-if="toast" class="toast-message" role="status" aria-live="polite" aria-atomic="true">{{ toast }}</div>
  </Transition>
</template>
