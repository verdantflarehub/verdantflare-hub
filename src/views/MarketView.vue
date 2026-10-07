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
const showcase = computed(() => selectedApp.value?.showcase || {});
const detailFacts = computed(() => {
  const app = selectedApp.value;
  if (!app) return [];
  return [
    ["开发者", app.developer], ["分类", app.category], ["应用版本", app.version],
    ["许可证", showcase.value.license], ["支持语言", showcase.value.languages], ["支持平台", showcase.value.platforms],
  ].filter(([, value]) => value);
});
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
      <div class="app-large-icon" :class="selectedApp.tone"><img v-if="selectedApp.publicIconUrl" :src="selectedApp.publicIconUrl" :alt="`${selectedApp.name} 图标`" /><AppIcon v-else :name="selectedApp.icon" :size="38" /></div>
      <div class="app-detail-copy">
        <div class="detail-meta"><span>{{ selectedApp.category }}</span><span>{{ listedOnly ? 'Hub 目录已上架 · 交付包待登记' : `${selectedApp.channel} · v${selectedApp.version}` }}</span></div>
        <h1>{{ selectedApp.name }}</h1>
        <p>{{ selectedApp.summary }}</p>
        <small v-if="selectedApp.developer" class="app-detail-developer">开发者 {{ selectedApp.developer }}</small>
        <div class="detail-actions">
          <a v-if="showcase.websiteUrl" class="button secondary" :href="showcase.websiteUrl" target="_blank" rel="noopener noreferrer">访问官网</a>
          <button v-if="!listedOnly" class="button secondary" @click="navigate(`/experience?app=${encodeURIComponent(selectedApp.id)}`)">查看体验状态</button>
        </div>
      </div>
      <StatusBadge :label="listedOnly ? '暂不可安装' : selectedApp.entitled ? '已授权' : '未授权'" />
    </section>
    <div class="market-detail-facts"><div><small>目录状态</small><strong>{{ listedOnly ? '资料已上架' : selectedApp.channel }}</strong></div><div><small>应用版本</small><strong>{{ selectedApp.version || '待登记' }}</strong></div><div><small>开发者</small><strong>{{ selectedApp.developer || '待补充' }}</strong></div><div><small>资源类型</small><strong>{{ selectedApp.gpu || '待核验' }}</strong></div><div><small>组织权益</small><strong>{{ listedOnly ? '暂不开放' : selectedApp.entitled ? '已授权' : '未授权' }}</strong></div></div>
    <section v-if="showcase.screenshots?.length" class="market-gallery" aria-label="应用展示截图"><a v-for="(url, index) in showcase.screenshots" :key="url" :href="url" target="_blank" rel="noopener noreferrer"><img :src="url" :alt="`${selectedApp.name} 截图 ${index + 1}`" loading="lazy" /></a></section>
    <div class="market-detail-layout">
      <div class="market-detail-main">
        <section class="content-panel"><h2>关于应用</h2><p class="market-detail-prose">{{ selectedApp.description || selectedApp.summary }}</p><h3 v-if="showcase.highlights?.length">功能亮点</h3><ul v-if="showcase.highlights?.length"><li v-for="item in showcase.highlights" :key="item">{{ item }}</li></ul></section>
        <section v-if="showcase.whatsNew" class="content-panel"><h2>新功能</h2><p class="market-detail-prose">{{ showcase.whatsNew }}</p></section>
        <section v-if="showcase.permissions?.length" class="content-panel"><h2>所需权限</h2><ul><li v-for="item in showcase.permissions" :key="item">{{ item }}</li></ul></section>
        <section class="content-panel market-runtime-note"><h2>体验与运行</h2><p>{{ listedOnly ? '当前为应用介绍，尚无交付包和在线体验。' : '当前目录版本不代表已通过 Station 安装与运行验证；在线体验链路尚未接入。' }}</p></section>
      </div>
      <aside class="content-panel market-detail-info"><h2>信息</h2><dl><div v-for="[label, value] in detailFacts" :key="label"><dt>{{ label }}</dt><dd>{{ value }}</dd></div><div><dt>CPU</dt><dd>{{ selectedApp.cpu || '待核验' }}</dd></div><div><dt>内存</dt><dd>{{ selectedApp.memory || '待核验' }}</dd></div><div><dt>磁盘</dt><dd>{{ selectedApp.disk || '待核验' }}</dd></div><div><dt>GPU</dt><dd>{{ selectedApp.gpu || '待核验' }}</dd></div><div><dt>在线体验</dt><dd>未开放</dd></div></dl><div class="market-detail-links"><a v-if="showcase.docsUrl" :href="showcase.docsUrl" target="_blank" rel="noopener noreferrer">文档 ↗</a><a v-if="showcase.websiteUrl" :href="showcase.websiteUrl" target="_blank" rel="noopener noreferrer">网站 ↗</a><a v-if="showcase.sourceUrl" :href="showcase.sourceUrl" target="_blank" rel="noopener noreferrer">源代码 ↗</a></div></aside>
    </div>
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
