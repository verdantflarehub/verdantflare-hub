<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import BrandAppIcon from "../components/BrandAppIcon.vue";
import CatalogCard from "../components/CatalogCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate, replace } from "../router";
import { appCardActions, appCardTags, catalogStatus } from "../utils/appCatalogPresentation";
import { marketAppIdFromPath, marketFiltersForCatalog, readMarketListState, readMarketReturnState, resolvedMarketAppId, withMarketListState } from "../utils/marketNavigation";

const props = defineProps({ path: String, query: { type: String, default: "" }, organization: Object });
const organizationId = computed(() => props.organization?.organizationId);
const search = ref("");
const activeCategory = ref("全部");
const marketPage = ref(null);
const searchInput = ref(null);
const apps = ref([]);
const loading = ref(true);
const loadError = ref("");
let disposed = false;
let loadSequence = 0;
let restoreSequence = 0;
let restoringScroll = false;
let scrollRestorationCancelled = false;
let applyingFilters = false;
let scrollSaveTimer;

const selectedId = computed(() => marketAppIdFromPath(props.path));
const selectedApp = computed(() => apps.value.find((app) => app.id === resolvedMarketAppId(selectedId.value, apps.value)));
watch([selectedId, selectedApp], ([id, app]) => {
  if (id && app?.id !== id) replace(`/market/apps/${app.id}${window.location.search}${window.location.hash}`);
});
const listedOnly = computed(() => selectedApp.value?.channel === "Listed");
const showcase = computed(() => selectedApp.value?.showcase || {});
const detailFacts = computed(() => {
  const app = selectedApp.value;
  if (!app) return [];
  return [
    ["开发者", app.developer], ["分类", app.category],
    ["许可证", showcase.value.license], ["支持语言", showcase.value.languages],
  ].filter(([, value]) => value);
});
const categories = computed(() => ["全部", ...new Set(apps.value.map((app) => app.category).filter(Boolean))]);
const filteredApps = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return apps.value.filter((app) => {
    const categoryMatch = activeCategory.value === "全部" || app.category === activeCategory.value;
    const keywordMatch = !keyword || [app.name, app.category, app.summary].some((value) => String(value || "").toLowerCase().includes(keyword));
    return categoryMatch && keywordMatch;
  });
});

const isCurrentList = () => !disposed && props.path === "/market" && window.location.pathname.replace(/\/+$/, "") === "/market";

const saveListContext = () => {
  if (!isCurrentList() || loading.value || loadError.value || restoringScroll) return;
  const context = { organizationId: organizationId.value, search: search.value, category: activeCategory.value, scrollY: window.scrollY };
  try {
    window.history.replaceState(withMarketListState(window.history.state, context), "");
  } catch {
    // History persistence is optional when a browser restricts replaceState.
  }
};

const scheduleScrollSave = () => {
  window.clearTimeout(scrollSaveTimer);
  scrollSaveTimer = window.setTimeout(saveListContext, 150);
};

const cancelScrollRestoration = (event) => {
  if (event.type === "keydown" && !["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) return;
  if (selectedId.value || (!loading.value && !restoringScroll)) return;
  scrollRestorationCancelled = true;
  restoreSequence += 1;
  restoringScroll = false;
  scheduleScrollSave();
};

const restoreListContext = async (context) => {
  const sequence = ++restoreSequence;
  restoringScroll = !scrollRestorationCancelled;
  const restored = marketFiltersForCatalog(context, categories.value);
  applyingFilters = true;
  search.value = restored.search;
  activeCategory.value = restored.category;
  applyingFilters = false;
  await nextTick();
  if (scrollRestorationCancelled) {
    saveListContext();
    return;
  }
  // The shell replaces views with an out-in transition. Wait until this list is
  // rendered and its entrance finishes, so loading/transition layout cannot clamp the offset.
  await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
  await Promise.allSettled((marketPage.value?.getAnimations?.() || []).map((animation) => animation.finished));
  if (sequence !== restoreSequence || !isCurrentList()) return;
  window.scrollTo({ top: restored.scrollY, behavior: "instant" });
  restoringScroll = false;
  saveListContext();
};

watch([search, activeCategory], () => {
  if (applyingFilters) return;
  restoreSequence += 1;
  restoringScroll = false;
  saveListContext();
}, { flush: "sync" });

const loadApps = async () => {
  const sequence = ++loadSequence;
  const requestedOrganization = organizationId.value;
  restoreSequence += 1;
  scrollRestorationCancelled = false;
  loading.value = true;
  loadError.value = "";
  try {
    const result = (await controlApi.listApps()) || [];
    if (disposed || sequence !== loadSequence || requestedOrganization !== organizationId.value) return;
    apps.value = result;
    loading.value = false;
    if (!selectedId.value) await restoreListContext(readMarketListState(window.history.state, requestedOrganization));
  } catch (cause) {
    if (disposed || sequence !== loadSequence) return;
    loadError.value = cause instanceof Error ? cause.message : "应用市场加载失败";
  } finally {
    if (!disposed && sequence === loadSequence) loading.value = false;
  }
};

const returnToMarket = () => {
  if (readMarketReturnState(window.history.state, organizationId.value)) window.history.back();
  else navigate("/market");
};

const clearFilters = async () => {
  search.value = "";
  activeCategory.value = "全部";
  await nextTick();
  searchInput.value?.focus({ preventScroll: true });
};

watch(organizationId, () => {
  apps.value = [];
  loadApps();
});

onMounted(() => {
  window.addEventListener("scroll", scheduleScrollSave, { passive: true });
  window.addEventListener("pagehide", saveListContext);
  for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) window.addEventListener(event, cancelScrollRestoration, { passive: true });
  loadApps();
});

onBeforeUnmount(() => {
  disposed = true;
  loadSequence += 1;
  restoreSequence += 1;
  window.clearTimeout(scrollSaveTimer);
  window.removeEventListener("scroll", scheduleScrollSave);
  window.removeEventListener("pagehide", saveListContext);
  for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) window.removeEventListener(event, cancelScrollRestoration);
});
</script>

<template>
  <div v-if="loading" class="page"><section class="empty-state"><div class="loading-ring" /><strong>正在加载应用市场</strong><span>读取当前组织可见的应用与权益…</span></section></div>

  <div v-else-if="loadError" class="page"><section class="empty-state"><AppIcon name="warning" :size="28" /><strong>应用市场加载失败</strong><span>{{ loadError }}</span><button class="button secondary" @click="loadApps">重新加载</button></section></div>

  <div v-else-if="selectedApp" class="page app-detail-page">
    <button class="back-button" @click="returnToMarket"><AppIcon name="arrow" :size="16" />返回应用市场</button>
    <section class="app-detail-hero">
      <div class="app-large-icon" :class="selectedApp.tone"><BrandAppIcon :icon-url="selectedApp.publicIconUrl" :icon-ref="selectedApp.iconRef" :brand="selectedApp.brand" :fallback-icon="selectedApp.icon || 'market'" :size="38" :alt="`${selectedApp.name} 图标`" /></div>
      <div class="app-detail-copy">
        <div class="detail-meta"><span>{{ selectedApp.category }}</span><span>应用资料</span></div>
        <h1>{{ selectedApp.name }}</h1>
        <p>{{ selectedApp.summary }}</p>
        <small v-if="selectedApp.developer" class="app-detail-developer">开发者 {{ selectedApp.developer }}</small>
        <div class="detail-actions">
          <a v-if="showcase.websiteUrl" class="button secondary" :href="showcase.websiteUrl" target="_blank" rel="noopener noreferrer">访问官网</a>
        </div>
      </div>
      <StatusBadge :label="catalogStatus(selectedApp)" />
    </section>
    <section class="content-panel market-availability"><h2>当前可用范围</h2><p>在这里查看应用介绍、截图和文档。Hub 暂不提供应用在线试用或安装。</p><p><strong>下一步</strong> · 先了解应用是否适合你的需求。应用获取与安装将由 Studio 在关联 Station 上完成，这条分发链路仍在对接。</p></section>
    <section v-if="showcase.screenshots?.length" class="market-gallery" aria-label="应用展示截图"><a v-for="(url, index) in showcase.screenshots" :key="url" :href="url" target="_blank" rel="noopener noreferrer"><img :src="url" :alt="`${selectedApp.name} 截图 ${index + 1}`" loading="lazy" /></a></section>
    <div class="market-detail-layout">
      <div class="market-detail-main">
        <section class="content-panel"><h2>关于应用</h2><p class="market-detail-prose">{{ selectedApp.description || selectedApp.summary }}</p><h3 v-if="showcase.highlights?.length">功能亮点</h3><ul v-if="showcase.highlights?.length"><li v-for="item in showcase.highlights" :key="item">{{ item }}</li></ul></section>
        <section v-if="showcase.whatsNew" class="content-panel"><h2>新功能</h2><p class="market-detail-prose">{{ showcase.whatsNew }}</p></section>
        <section v-if="showcase.permissions?.length" class="content-panel"><h2>所需权限</h2><ul><li v-for="item in showcase.permissions" :key="item">{{ item }}</li></ul></section>
      </div>
      <aside class="content-panel market-detail-info">
        <h2>应用信息</h2><dl><div v-for="[label, value] in detailFacts" :key="label"><dt>{{ label }}</dt><dd>{{ value }}</dd></div></dl>
        <div class="market-detail-links"><a v-if="showcase.docsUrl" :href="showcase.docsUrl" target="_blank" rel="noopener noreferrer">文档 ↗</a><a v-if="showcase.websiteUrl" :href="showcase.websiteUrl" target="_blank" rel="noopener noreferrer">网站 ↗</a><a v-if="showcase.sourceUrl" :href="showcase.sourceUrl" target="_blank" rel="noopener noreferrer">源代码 ↗</a></div>
        <details class="market-technical-details"><summary>技术详情</summary><dl>
          <div><dt>应用 ID</dt><dd>{{ selectedApp.id }}</dd></div><div><dt>目录版本</dt><dd>{{ selectedApp.version || '待登记' }}</dd></div><div><dt>发布通道</dt><dd>{{ selectedApp.channel }}</dd></div>
          <div><dt>组织权益</dt><dd>{{ listedOnly ? '暂不开放' : selectedApp.entitled ? '已授权' : '未授权' }}</dd></div><div><dt>权益版本</dt><dd>v{{ organization.entitlementVersion }}</dd></div>
          <div v-if="showcase.platforms"><dt>支持平台</dt><dd>{{ showcase.platforms }}</dd></div><div><dt>CPU</dt><dd>{{ selectedApp.cpu || '待核验' }}</dd></div><div><dt>内存</dt><dd>{{ selectedApp.memory || '待核验' }}</dd></div><div><dt>磁盘</dt><dd>{{ selectedApp.disk || '待核验' }}</dd></div><div><dt>GPU</dt><dd>{{ selectedApp.gpu || '待核验' }}</dd></div><div><dt>Station 分发</dt><dd>尚未接通</dd></div>
        </dl><p class="credit-help">资源为目录参考信息。目录版本与组织授权不代表当前 Station 已通过安装检查。</p></details>
      </aside>
    </div>
  </div>

  <div v-else-if="selectedId" class="page">
    <button class="back-button" @click="returnToMarket"><AppIcon name="arrow" :size="16" />返回应用市场</button>
    <section class="empty-state"><AppIcon name="warning" :size="28" /><strong>应用不在当前目录</strong><span>应用 {{ selectedId }} 未公开发布，或当前组织无权查看。</span></section>
  </div>

  <div v-else ref="marketPage" class="page market-page" @click.capture="saveListContext">
    <header class="page-header">
      <div><h1>应用市场</h1><p>了解应用、目录版本与组织权益。是否能安装和运行，以当前 Station 在 Studio 的检查结果为准；Hub 暂不提供应用在线试用。</p></div>
    </header>

    <div class="market-tools">
      <label class="search-field"><AppIcon name="search" :size="18" /><input ref="searchInput" v-model="search" type="search" aria-label="搜索应用、分类或能力" placeholder="搜索应用、分类或能力" /></label>
      <div class="category-tabs" role="group" aria-label="应用分类">
        <button v-for="category in categories" :key="category" type="button" :class="{ active: activeCategory === category }" :aria-pressed="activeCategory === category" @click="activeCategory = category">{{ category }}</button>
      </div>
    </div>

    <section class="market-catalog">
      <div class="section-heading"><div><h2>应用列表</h2><p>{{ filteredApps.length }} 个应用 · 其中 {{ filteredApps.filter((app) => app.entitled).length }} 个已授权 · 权益版本 v{{ organization.entitlementVersion }}</p></div></div>
      <div class="catalog-card-grid">
        <CatalogCard v-for="app in filteredApps" :key="app.id" :title="app.name" :meta="app.version ? `${app.developer || app.category} · 目录版本 v${app.version}` : `${app.developer || app.category} · 版本待登记`" :description="app.summary" :icon="app.icon || 'market'" :icon-url="app.publicIconUrl" :icon-ref="app.iconRef || ''" :brand="app.brand || ''" :tags="appCardTags(app)" :status="catalogStatus(app)" status-tone="neutral" :actions="appCardActions(app)" />
      </div>
    </section>
    <div v-if="apps.length === 0" class="empty-state"><AppIcon name="market" :size="28" /><strong>暂无可见应用</strong><span>当前组织暂无可见的应用，稍后可重新加载查看。</span><button class="button secondary" @click="loadApps">重新加载</button></div>
    <div v-else-if="filteredApps.length === 0" class="empty-state" role="status"><AppIcon name="search" :size="28" /><strong>没有匹配的应用</strong><span>换个关键词，或清空筛选查看全部应用。</span><button class="button secondary" @click="clearFilters">清空筛选</button></div>
  </div>
</template>
