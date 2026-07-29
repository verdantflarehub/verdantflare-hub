<script setup>
import { computed, onMounted, ref } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";

const props = defineProps({ path: String, query: { type: String, default: "" }, organization: Object });
const emit = defineEmits(["toast"]);
const search = ref("");
const activeCategory = ref("全部");
const apps = ref([]);
const loading = ref(true);
const loadError = ref("");

const selectedId = computed(() => (props.path.startsWith("/market/apps/") ? props.path.split("/").at(-1) : ""));
const selectedApp = computed(() => apps.value.find((app) => app.id === selectedId.value));
const categories = computed(() => ["全部", ...new Set(apps.value.map((app) => app.category))]);
const filteredApps = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return apps.value.filter((app) => {
    const categoryMatch = activeCategory.value === "全部" || app.category === activeCategory.value;
    const keywordMatch = !keyword || [app.name, app.category, app.summary].some((value) => value.toLowerCase().includes(keyword));
    return categoryMatch && keywordMatch;
  });
});

const startExperience = (app) => {
  sessionStorage.setItem("vf_selected_experience_app", app.id);
  navigate(`/experience?app=${encodeURIComponent(app.id)}`);
};

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
  <div v-if="loading" class="page"><section class="empty-state"><div class="loading-ring" /><strong>正在加载应用权益</strong><span>读取当前组织可用的应用与发布通道…</span></section></div>

  <div v-else-if="loadError" class="page"><section class="empty-state"><AppIcon name="warning" :size="28" /><strong>应用市场加载失败</strong><span>{{ loadError }}</span><button class="button secondary" @click="loadApps">重新加载</button></section></div>

  <div v-else-if="selectedApp" class="page app-detail-page">
    <button class="back-button" @click="navigate('/market')"><AppIcon name="arrow" :size="16" />返回应用市场</button>
    <section class="app-detail-hero">
      <div class="app-large-icon" :class="selectedApp.tone"><AppIcon :name="selectedApp.icon" :size="38" /></div>
      <div class="app-detail-copy">
        <div class="detail-meta"><span>{{ selectedApp.category }}</span><span>{{ selectedApp.channel }} · v{{ selectedApp.version }}</span></div>
        <h1>{{ selectedApp.name }}</h1>
        <p>{{ selectedApp.summary }} 可直接创建临时体验 Session，或查看资源与版本信息后转入 Studio。</p>
        <div class="detail-actions">
          <button class="button primary" @click="startExperience(selectedApp)"><AppIcon name="spark" :size="17" />开始在线体验</button>
          <button class="button secondary" @click="$emit('toast', '已提交 Studio 开通申请')">转入 Studio</button>
        </div>
      </div>
      <StatusBadge :label="selectedApp.status" />
    </section>

    <div class="detail-grid">
      <section class="content-panel">
        <div class="section-heading"><div><h2>应用能力</h2><p>本组织当前可用的发布版本与体验范围。</p></div></div>
        <div class="feature-lines">
          <div><AppIcon name="check" :size="17" /><span><strong>临时工作空间</strong><small>会话结束后按清理策略删除临时素材与运行数据。</small></span></div>
          <div><AppIcon name="check" :size="17" /><span><strong>结果预览与下载</strong><small>支持体验结果预览，正式资产需转入 Studio 管理。</small></span></div>
          <div><AppIcon name="check" :size="17" /><span><strong>组织权益保护</strong><small>创建 Session 前会再次检查权益版本、并发与体验额度。</small></span></div>
        </div>
      </section>
      <aside class="content-panel app-specs">
        <h2>资源与限制</h2>
        <dl><div><dt>发布通道</dt><dd>{{ selectedApp.channel }}</dd></div><div><dt>应用版本</dt><dd>{{ selectedApp.version }}</dd></div><div><dt>推荐资源</dt><dd>{{ selectedApp.gpu }}</dd></div><div><dt>Session</dt><dd>{{ selectedApp.duration }}</dd></div><div><dt>计费方式</dt><dd>按实际运行分钟</dd></div></dl>
      </aside>
    </div>

    <section class="content-panel version-panel">
      <div class="section-heading"><div><h2>版本记录</h2><p>当前组织只看到已授权的发布通道。</p></div></div>
      <div class="release-line"><span class="release-dot" /><strong>{{ selectedApp.version }}</strong><span>{{ selectedApp.channel }}</span><span>2026-07-15</span><StatusBadge label="已发布" /></div>
      <div class="release-line muted"><span class="release-dot" /><strong>上一个版本</strong><span>Deprecated</span><span>2026-06-28</span><span>已归档</span></div>
    </section>
  </div>

  <div v-else-if="selectedId" class="page">
    <button class="back-button" @click="navigate('/market')"><AppIcon name="arrow" :size="16" />返回应用市场</button>
    <section class="empty-state"><AppIcon name="warning" :size="28" /><strong>当前组织尚未获得该应用</strong><span>应用 {{ selectedId }} 不在当前组织的授权目录中，请联系组织管理员申请权益。</span></section>
  </div>

  <div v-else class="page market-page">
    <header class="page-header">
      <div><span class="page-overline">APP MARKET</span><h1>应用市场</h1><p>发现适合团队的已授权应用，查看版本、资源要求与在线体验入口。</p></div>
      <button class="button primary" @click="navigate('/experience')"><AppIcon name="spark" :size="17" />进入体验中心</button>
    </header>

    <section class="featured-app">
      <div class="featured-copy"><span>本周推荐</span><h2>Wan Video Studio</h2><p>把脚本、分镜和参考动作快速转化为可测试的视频片段。Preview 版本现已向 {{ organization.name }} 开放。</p><button @click="navigate('/market/apps/wan-video')">查看应用详情<AppIcon name="arrow" :size="16" /></button></div>
      <div class="featured-visual" aria-hidden="true"><div class="film-frame frame-one"><span /></div><div class="film-frame frame-two"><span /></div><div class="timeline-track"><i /><i /><i /><i /></div><div class="play-orb"><AppIcon name="video" :size="26" /></div></div>
    </section>

    <div class="market-tools">
      <label class="search-field"><AppIcon name="search" :size="18" /><input v-model="search" type="search" placeholder="搜索应用、分类或能力" /></label>
      <div class="category-tabs">
        <button v-for="category in categories" :key="category" :class="{ active: activeCategory === category }" @click="activeCategory = category">{{ category }}</button>
      </div>
    </div>

    <div class="market-result-line"><strong>{{ filteredApps.length }} 个可用应用</strong><span>权益版本 v{{ organization.entitlementVersion }}</span></div>
    <section class="app-grid">
      <article v-for="app in filteredApps" :key="app.id" class="app-card" role="button" tabindex="0" @click="navigate(`/market/apps/${app.id}`)" @keydown.enter="navigate(`/market/apps/${app.id}`)" @keydown.space.prevent="navigate(`/market/apps/${app.id}`)">
        <div class="app-card-top"><span class="app-card-icon" :class="app.tone"><AppIcon :name="app.icon" :size="25" /></span><StatusBadge :label="app.status" /></div>
        <div><span class="app-category">{{ app.category }}</span><h2>{{ app.name }}</h2><p>{{ app.summary }}</p></div>
        <footer><span>{{ app.channel }} · v{{ app.version }}</span><AppIcon name="arrow" :size="17" /></footer>
      </article>
    </section>
    <div v-if="filteredApps.length === 0" class="empty-state"><AppIcon name="search" :size="28" /><strong>没有匹配的应用</strong><span>换个关键词或清除分类筛选。</span></div>
  </div>
</template>
