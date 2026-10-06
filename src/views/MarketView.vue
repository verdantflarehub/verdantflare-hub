<script setup>
import { computed, onMounted, ref } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import CatalogCard from "../components/CatalogCard.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";

const props = defineProps({ path: String, query: { type: String, default: "" }, organization: Object });
const search = ref("");
const activeCategory = ref("全部");
const apps = ref([]);
const loading = ref(true);
const loadError = ref("");

const selectedId = computed(() => (props.path.startsWith("/market/apps/") ? props.path.split("/").at(-1) : ""));
const selectedApp = computed(() => apps.value.find((app) => app.id === selectedId.value));
const listedOnly = computed(() => selectedApp.value?.channel === "Listed");
const categories = computed(() => ["全部", ...new Set(apps.value.map((app) => app.category))]);
const filteredApps = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return apps.value.filter((app) => {
    const categoryMatch = activeCategory.value === "全部" || app.category === activeCategory.value;
    const keywordMatch = !keyword || [app.name, app.category, app.summary].some((value) => value.toLowerCase().includes(keyword));
    return categoryMatch && keywordMatch;
  });
});
const appCardTags = (app) => [
  app.category,
  app.channel === "Listed" ? "资料已上架" : app.channel,
  app.gpu || "资源待补充",
].filter(Boolean);
const appCardActions = (app) => app.channel === "Listed"
  ? [{ label: "查看详情", to: `/market/apps/${encodeURIComponent(app.id)}`, primary: true }]
  : [
      { label: "体验状态", to: `/experience?app=${encodeURIComponent(app.id)}` },
      { label: "查看详情", to: `/market/apps/${encodeURIComponent(app.id)}`, primary: true },
    ];
const loadApps = async () => {
  loading.value = true;
  loadError.value = "";
  try {
    apps.value = (await controlApi.listApps()) || [];
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : "应用市场加载失败";
  } finally {
    loading.value = false;
  }
};

onMounted(loadApps);
</script>

<template>
  <div v-if="loading" class="page"><section class="empty-state"><div class="loading-ring" /><strong>正在加载应用目录</strong><span>读取已公开应用与当前组织权益…</span></section></div>

  <div v-else-if="loadError" class="page"><section class="empty-state"><AppIcon name="warning" :size="28" /><strong>应用市场加载失败</strong><span>{{ loadError }}</span><button class="button secondary" @click="loadApps">重新加载</button></section></div>

  <div v-else-if="selectedApp" class="page app-detail-page">
    <button class="back-button" @click="navigate('/market')"><AppIcon name="arrow" :size="16" />返回应用市场</button>
    <section class="app-detail-hero">
      <div class="app-large-icon" :class="selectedApp.tone"><AppIcon :name="selectedApp.icon" :size="38" /></div>
      <div class="app-detail-copy">
        <div class="detail-meta"><span>{{ selectedApp.category }}</span><span>{{ listedOnly ? 'Hub 目录已上架 · 交付包待登记' : `${selectedApp.channel} · v${selectedApp.version}` }}</span></div>
        <h1>{{ selectedApp.name }}</h1>
        <p>{{ selectedApp.summary }}</p>
        <div class="detail-actions">
          <button v-if="!listedOnly" class="button primary" @click="navigate(`/experience?app=${encodeURIComponent(selectedApp.id)}`)"><AppIcon name="spark" :size="17" />查看体验入口</button>
        </div>
      </div>
      <StatusBadge :label="listedOnly ? '暂不可安装' : selectedApp.entitled ? '已授权' : '未授权'" />
    </section>

    <div class="detail-grid">
      <section class="content-panel">
        <div class="section-heading"><div><h2>应用信息</h2><p>此处仅展示 Control 中的目录资料；运行能力尚未核验。</p></div></div>
        <div class="feature-lines">
          <div><AppIcon name="warning" :size="17" /><span><strong>{{ listedOnly ? '交付包待登记' : '在线运行待接入' }}</strong><small>{{ listedOnly ? 'Center 尚未登记可供 Station 校验的不可变应用版本。' : '尚无体验工作区、结果预览或下载能力。' }}</small></span></div>
          <div><AppIcon :name="listedOnly ? 'warning' : 'check'" :size="17" /><span><strong>{{ listedOnly ? '暂不开放使用权益' : '组织应用权益' }}</strong><small>{{ listedOnly ? '目录上架仅供了解应用；不能安装或在线体验。' : selectedApp.entitled ? '当前组织已获得该应用权益。' : '应用可浏览，当前组织尚未获得使用权益。' }}</small></span></div>
        </div>
      </section>
      <aside class="content-panel app-specs">
        <h2>资源与限制</h2>
        <dl><div><dt>目录状态</dt><dd>{{ listedOnly ? '已上架 · 待交付' : selectedApp.channel }}</dd></div><div><dt>应用版本</dt><dd>{{ selectedApp.version || '待登记' }}</dd></div><div><dt>推荐资源</dt><dd>{{ selectedApp.gpu || '待核验' }}</dd></div><div><dt>组织权益</dt><dd>{{ listedOnly ? '暂不开放' : selectedApp.entitled ? '已授权' : '未授权' }}</dd></div><div><dt>在线体验</dt><dd>{{ listedOnly ? '未开放' : '运行链路待接入' }}</dd></div></dl>
      </aside>
    </div>

    <section v-if="!listedOnly" class="content-panel version-panel">
      <div class="section-heading"><div><h2>当前版本</h2><p>当前组织只看到已授权的发布通道。</p></div></div>
      <div class="release-line"><span class="release-dot" /><strong>{{ selectedApp.version }}</strong><span>{{ selectedApp.channel }}</span><StatusBadge label="已发布" /></div>
    </section>
  </div>

  <div v-else-if="selectedId" class="page">
    <button class="back-button" @click="navigate('/market')"><AppIcon name="arrow" :size="16" />返回应用市场</button>
    <section class="empty-state"><AppIcon name="warning" :size="28" /><strong>应用不在当前目录</strong><span>应用 {{ selectedId }} 未公开发布，或当前组织无权查看。</span></section>
  </div>

  <div v-else class="page market-page">
    <header class="page-header">
      <div><h1>应用市场</h1><p>浏览已公开应用；是否获得使用权益与在线运行能力会分别标明。</p></div>
    </header>

    <div class="market-tools">
      <label class="search-field"><AppIcon name="search" :size="18" /><input v-model="search" type="search" placeholder="搜索应用、分类或能力" /></label>
      <div class="category-tabs">
        <button v-for="category in categories" :key="category" :class="{ active: activeCategory === category }" @click="activeCategory = category">{{ category }}</button>
      </div>
    </div>

    <section class="market-catalog">
      <div class="section-heading"><div><h2>应用目录</h2><p>{{ filteredApps.length }} 个应用 · 其中 {{ filteredApps.filter((app) => app.entitled).length }} 个已授权 · 权益版本 v{{ organization.entitlementVersion }}</p></div></div>
      <div class="catalog-card-grid">
        <CatalogCard v-for="app in filteredApps" :key="app.id" :title="app.name" :meta="app.version ? `${app.developer || app.category} · v${app.version}` : `${app.developer || app.category} · 版本待登记`" :description="app.summary" :icon="app.icon || 'market'" :icon-url="app.publicIconUrl" :tags="appCardTags(app)" :status="app.channel === 'Listed' ? '暂不可安装' : app.entitled ? '已授权' : '未授权'" :status-tone="app.entitled ? 'positive' : 'neutral'" :actions="appCardActions(app)" />
      </div>
    </section>
    <div v-if="filteredApps.length === 0" class="empty-state"><AppIcon name="search" :size="28" /><strong>没有匹配的应用</strong><span>换个关键词或清除分类筛选。</span></div>
  </div>
</template>
