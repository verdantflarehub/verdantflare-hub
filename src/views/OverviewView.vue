<script setup>
import { computed, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";

const props = defineProps({ organization: { type: Object, required: true }, internal: Boolean });
const overview = ref(null);
const models = ref([]);
const keys = ref([]);
const apps = ref([]);
const experiences = ref([]);
const tasks = ref([]);
const loading = ref(true);
const error = ref("");
let loadGeneration = 0;

const featuredApp = computed(() => apps.value[0] || null);
const formatTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || "—" : date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const load = async () => {
  const generation = ++loadGeneration;
  loading.value = true;
  error.value = "";
  try {
    const [summary, availableModels, availableKeys, availableApps, recentSessions, recentTasks] = await Promise.all([
      controlApi.getOverview(), controlApi.listModels(), controlApi.listApiKeys(),
      controlApi.listApps(), controlApi.listExperienceSessions(), controlApi.listApiTasks(),
    ]);
    if (generation !== loadGeneration) return;
    overview.value = summary;
    models.value = availableModels || [];
    keys.value = availableKeys || [];
    apps.value = availableApps || [];
    experiences.value = (recentSessions || []).slice(0, 3);
    tasks.value = (recentTasks || []).slice(0, 3);
  } catch (cause) {
    if (generation === loadGeneration) error.value = cause instanceof Error ? cause.message : "概览加载失败";
  } finally {
    if (generation === loadGeneration) loading.value = false;
  }
};
watch(() => props.organization.organizationId, load, { immediate: true });
</script>

<template>
  <div class="page overview-page">
    <header class="overview-hero">
      <div>
        <h1>工作台</h1>
        <p>查看当前组织的目录与运营记录；在线体验和模型网关调用尚未接入。</p>
        <div class="welcome-actions">
          <button class="button primary" @click="navigate('/market')"><AppIcon name="market" :size="18" />浏览应用市场<AppIcon name="arrow" :size="16" /></button>
          <button class="button secondary" @click="navigate('/api/models')"><AppIcon name="models" :size="18" />查看模型目录</button>
        </div>
      </div>
      <div class="hero-landscape" aria-hidden="true">
        <i /><i /><i />
        <span>让优秀的模型与应用<br />创造更大的可能</span>
      </div>
    </header>

    <section v-if="error" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>概览数据加载失败</strong><p>{{ error }}</p></div><button class="button secondary" @click="load">重新加载</button></section>
    <p v-if="loading" class="page-loading">正在读取当前组织的资源与用量…</p>

    <section v-if="!loading && !error" class="safety-note"><AppIcon name="warning" :size="19" /><div><strong>部分数据尚未接通权威来源</strong><p>模型、任务、用量与账单可能仍含初始化记录，不能作为实时可用性或结算依据。</p></div></section>

    <section v-if="!loading && !error" class="resource-rail">
      <header><strong>我的资源与用量</strong><button @click="navigate('/api/usage')">查看用量详情<AppIcon name="arrow" :size="15" /></button></header>
      <div class="resource-items">
        <div><span class="resource-icon"><AppIcon name="models" :size="20" /></span><span><small>模型目录记录</small><strong>{{ models.length }}</strong></span></div>
        <div><span class="resource-icon"><AppIcon name="market" :size="20" /></span><span><small>应用权益记录</small><strong>{{ overview?.availableApps ?? apps.length }}</strong></span></div>
        <div><span class="resource-icon"><AppIcon name="key" :size="20" /></span><span><small>历史 Key 记录</small><strong>{{ keys.length }}</strong></span></div>
        <div><span class="resource-icon"><AppIcon name="usage" :size="20" /></span><span><small>API 余额</small><strong>未接入</strong></span></div>
      </div>
    </section>

    <section v-if="featuredApp && !error" class="dashboard-feature">
      <div class="feature-mark"><img src="/brand/verdantflare-logo.svg" alt="" /></div>
      <div class="feature-message"><small>当前组织应用目录</small><h2>{{ featuredApp.name }}</h2><p>{{ featuredApp.summary }}</p><button class="button primary" @click="navigate(`/market/apps/${featuredApp.id}`)">查看应用<AppIcon name="arrow" :size="16" /></button></div>
      <div class="feature-art" aria-hidden="true"><span /><i /><i /></div>
      <ul><li><AppIcon name="market" :size="16" />{{ featuredApp.category }}</li><li><AppIcon name="release" :size="16" />{{ featuredApp.channel }} · {{ featuredApp.version }}</li><li><AppIcon name="usage" :size="16" />{{ featuredApp.gpu || '资源待补充' }}</li></ul>
    </section>

    <div v-if="!loading && !error" class="overview-lists">
      <section>
        <div class="section-heading"><div><h2>最近体验</h2></div><button class="text-button" @click="navigate('/experience')">查看全部<AppIcon name="arrow" :size="14" /></button></div>
        <div class="dashboard-list">
          <button v-for="item in experiences" :key="item.id" @click="navigate(`/experience/sessions/${item.id}`)">
            <span class="list-emblem"><AppIcon name="experience" :size="17" /></span><span class="list-copy"><strong>{{ item.app }}</strong><small>{{ item.id }}</small></span><time>{{ formatTime(item.startedAt) }}</time><StatusBadge :label="item.status" />
          </button>
          <p v-if="!experiences.length" class="prototype-empty-inline">暂无体验记录</p>
        </div>
      </section>
      <section>
        <div class="section-heading"><div><h2>最近 API 任务</h2></div><button class="text-button" @click="navigate('/api/tasks')">查看全部<AppIcon name="arrow" :size="14" /></button></div>
        <div class="dashboard-list">
          <button v-for="task in tasks" :key="task.id" @click="navigate('/api/tasks')">
            <span class="list-emblem"><AppIcon name="tasks" :size="17" /></span><span class="list-copy"><strong>{{ task.model }}</strong><small>{{ task.id }}</small></span><time>{{ task.created || '—' }}</time><StatusBadge :label="task.status" />
          </button>
          <p v-if="!tasks.length" class="prototype-empty-inline">暂无 API 任务</p>
        </div>
      </section>
    </div>
  </div>
</template>
