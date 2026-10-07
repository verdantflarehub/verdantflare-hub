<script setup>
import { computed, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import ModelExperiencePanel from "../components/ModelExperiencePanel.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";

const props = defineProps({ organization: Object, query: { type: String, default: "" } });
const selection = computed(() => new URLSearchParams(props.query));
const modelId = computed(() => selection.value.get("model") || "");
const appId = computed(() => selection.value.get("app") || "");
const models = ref([]);
const apps = ref([]);
const catalogLoading = ref(true);
const catalogError = ref("");
const sessions = ref([]);
const sessionsError = ref("");
const selectedModel = computed(() => models.value.find((model) => model.id === modelId.value));
const selectedApp = computed(() => apps.value.find((app) => app.id === appId.value));
const loadCatalog = async () => {
  catalogLoading.value = true;
  catalogError.value = "";
  try {
    [models.value, apps.value] = await Promise.all([controlApi.listModels(), appId.value ? controlApi.listApps() : Promise.resolve([])]);
  } catch (cause) {
    catalogError.value = cause instanceof Error ? cause.message : "体验目录加载失败";
  } finally {
    catalogLoading.value = false;
  }
};
const loadSessions = async () => {
  sessionsError.value = "";
  try {
    sessions.value = (await controlApi.listExperienceSessions()) || [];
  } catch (cause) {
    sessionsError.value = cause instanceof Error ? cause.message : "Session 加载失败";
  }
};

watch([() => props.organization?.organizationId, appId], () => {
  loadCatalog();
  loadSessions();
}, { immediate: true });
</script>

<template>
  <div class="page experience-page">
    <header class="page-header">
      <div><span class="page-overline">EXPERIENCE CENTER</span><h1>{{ selectedModel?.name || selectedApp?.name || '在线体验' }}</h1><p>这里提供已开放模型的真实在线体验；应用请先在目录了解，安装与运行由 Studio 和当前 Station 管理。</p></div>
      <button v-if="modelId || appId" class="button secondary" @click="navigate('/experience')"><AppIcon name="arrow" :size="17" />选择其他能力</button>
    </header>

    <section v-if="catalogError" class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>体验目录加载失败</strong><p>{{ catalogError }}</p></div><button class="button secondary" @click="loadCatalog">重新加载</button></section>
    <section v-else-if="catalogLoading" class="empty-state"><div class="loading-ring" /><strong>正在核验体验目录</strong></section>

    <template v-else-if="modelId">
      <section v-if="!selectedModel" class="empty-state"><AppIcon name="warning" :size="28" /><strong>模型不在当前目录</strong><span>请从模型市场重新选择。</span><button class="button secondary" @click="navigate('/api/models')">返回模型市场</button></section>
      <template v-else>
        <div class="content-panel"><div class="section-heading"><div><h2>{{ selectedModel.name }}</h2><p>{{ selectedModel.provider }} · {{ selectedModel.type }} · {{ selectedModel.id }}</p></div><StatusBadge :label="selectedModel.experienceMode === 'chat' ? '体验已接入' : '体验待接入'" /></div></div>
        <ModelExperiencePanel v-if="selectedModel.experienceMode === 'chat'" :key="`${props.organization?.organizationId}:${modelId}`" :organization-id="props.organization?.organizationId" :model-id="modelId" :can-create-key="props.organization?.roles?.includes('organization_admin')" />
        <section v-else class="safety-note"><AppIcon name="warning" :size="19" /><div><strong>该模型尚未开放 Hub 在线体验</strong><p>目录上架与付费体验分开管理。可先查看 API 调用示例；Hub 不会切换到其他模型。</p><button class="button secondary" @click="navigate(`/api/playground?model=${encodeURIComponent(modelId)}`)">查看调用示例</button></div></section>
      </template>
    </template>

    <template v-else-if="appId">
      <section v-if="!selectedApp" class="empty-state"><AppIcon name="warning" :size="28" /><strong>未找到该应用</strong><span>请从应用市场重新选择。</span><button class="button secondary" @click="navigate('/market')">返回应用市场</button></section>
      <template v-else>
        <div class="content-panel"><div class="section-heading"><div><h2>{{ selectedApp.name }}</h2><p>{{ selectedApp.summary }}</p></div><StatusBadge label="Hub 不提供应用试用" /></div></div>
        <section class="safety-note"><AppIcon name="warning" :size="19" /><div><strong>应用在线体验暂不提供</strong><p>这是旧入口的说明页，不会创建 Session 或发起任务。目录资料和组织权益均不代表可安装；请在应用详情了解交付状态，未来以 Studio 对当前 Station 的真实检查结果为准。</p><button class="button secondary" @click="navigate(`/market/apps/${encodeURIComponent(appId)}`)">查看应用详情</button></div></section>
      </template>
    </template>

    <template v-else>
      <section class="content-panel"><div class="section-heading"><div><h2>选择模型</h2><p>从已上架模型进入对应体验；可用状态由管理端控制。</p></div><button class="text-button" @click="navigate('/api/models')">查看模型市场</button></div><div class="model-experience-run-list"><button v-for="model in models" :key="model.id" @click="navigate(`/experience?model=${encodeURIComponent(model.id)}`)"><span><strong>{{ model.name }}</strong><small>{{ model.id }}</small></span><StatusBadge :label="model.experienceMode === 'chat' ? '可体验' : '待接入'" /><AppIcon name="chevron" :size="16" /></button></div><p v-if="!models.length">暂无已上架模型。</p></section>
    </template>

    <section v-if="sessionsError" class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>历史 Session 加载失败</strong><p>{{ sessionsError }}</p></div><button class="button secondary" @click="loadSessions">重新加载</button></section>
    <section v-if="sessions.length" class="content-panel"><div class="section-heading"><div><h2>历史应用 Session 记录</h2><p>仅为数据库记录，不代表运行资源仍然可用。</p></div><button class="text-button" @click="loadSessions">刷新记录</button></div><div class="model-experience-run-list"><button v-for="session in sessions" :key="session.id" @click="navigate(`/experience/sessions/${session.id}`)"><span><strong>{{ session.app }}</strong><small>{{ session.id }}</small></span><StatusBadge label="待核验" /><AppIcon name="chevron" :size="16" /></button></div></section>
  </div>
</template>
