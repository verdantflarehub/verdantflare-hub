<script setup>
import { ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";

const props = defineProps({ organization: { type: Object, required: true } });
const experiences = ref([]);
const tasks = ref([]);
const loading = ref(true);
const error = ref("");
let loadGeneration = 0;

const formatTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || "—" : date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
const load = async () => {
  const generation = ++loadGeneration;
  loading.value = true;
  error.value = "";
  experiences.value = [];
  tasks.value = [];
  try {
    const [recentSessions, recentTasks] = await Promise.all([
      controlApi.listExperienceSessions(), controlApi.listApiTasks(),
    ]);
    if (generation !== loadGeneration) return;
    experiences.value = (recentSessions || []).slice(0, 3);
    tasks.value = (recentTasks || []).slice(0, 3);
  } catch (cause) {
    if (generation === loadGeneration) error.value = cause instanceof Error ? cause.message : "最近活动加载失败";
  } finally {
    if (generation === loadGeneration) loading.value = false;
  }
};
watch(() => props.organization.organizationId, load, { immediate: true });
</script>

<template>
  <div class="page overview-page">
    <header class="overview-heading">
      <div><h1>工作台</h1><p>你的模型、应用与使用记录，都在这里。</p></div>
      <div class="overview-heading-actions">
        <button class="button primary" @click="navigate('/market')">浏览应用市场<AppIcon name="arrow" :size="15" /></button>
        <button class="button secondary" @click="navigate('/api/models')">查看模型目录<AppIcon name="arrow" :size="15" /></button>
      </div>
    </header>

    <section class="overview-rail">
      <div class="overview-rail-intro"><h2>资源概览</h2><p>查看当前组织的授权、调用凭证与用量。</p></div>
      <button @click="navigate('/api/models')"><span class="overview-rail-icon"><AppIcon name="models" :size="19" /></span><span><strong>模型目录</strong><small>查看可用能力</small></span><AppIcon name="chevron" :size="15" /></button>
      <button @click="navigate('/market')"><span class="overview-rail-icon"><AppIcon name="market" :size="19" /></span><span><strong>应用权益</strong><small>查看组织授权</small></span><AppIcon name="chevron" :size="15" /></button>
      <button @click="navigate('/api/keys')"><span class="overview-rail-icon"><AppIcon name="key" :size="19" /></span><span><strong>API 密钥</strong><small>管理调用凭证</small></span><AppIcon name="chevron" :size="15" /></button>
      <button @click="navigate('/api/usage')"><span class="overview-rail-icon"><AppIcon name="usage" :size="19" /></span><span><strong>用量</strong><small>查看实际扣费</small></span><AppIcon name="chevron" :size="15" /></button>
    </section>

    <div class="overview-section-heading"><div><h2>从发现到使用</h2><p>Hub 提供浏览、体验与 API 接入；本地应用安装由 Studio 管理。</p></div><button class="text-button" @click="navigate('/market')">查看应用市场<AppIcon name="arrow" :size="15" /></button></div>
    <section class="overview-journey">
      <div class="overview-journey-copy"><h3>从想法开始。</h3><p>选择模型或应用，在授权范围内在线体验，或通过 API 接入。需要本地运行？前往 Studio，将应用安装到当前 Station。</p><button class="button primary" @click="navigate('/api/models')">浏览模型市场<AppIcon name="arrow" :size="15" /></button></div>
      <div class="overview-journey-steps"><h4>典型路径</h4><div>
        <div><b>01 / 发现</b><strong>模型与应用</strong><span>查看能力、版本与权益</span></div>
        <div><b>02 / 验证</b><strong>在线体验</strong><span>在授权范围内试用</span></div>
        <div><b>03 / 接入</b><strong>API 或 Studio</strong><span>按使用场景选择入口</span></div>
      </div></div>
    </section>

    <div class="overview-section-heading"><div><h2>最近活动</h2><p>继续上次的体验，或查看 API 任务进展。</p></div></div>
    <section v-if="error" class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>最近活动加载失败</strong><p>{{ error }}</p></div><button class="button secondary" @click="load">重新加载</button></section>
    <div class="overview-activity">
      <section class="overview-activity-panel">
        <header><h3>最近体验</h3><button class="text-button" @click="navigate('/experience')">查看全部<AppIcon name="arrow" :size="14" /></button></header>
        <p v-if="loading" class="overview-activity-state">正在加载体验记录…</p>
        <div v-else-if="!error && experiences.length" class="dashboard-list">
          <button v-for="item in experiences" :key="item.id" @click="navigate(`/experience/sessions/${item.id}`)"><span class="list-emblem"><AppIcon name="experience" :size="17" /></span><span class="list-copy"><strong>{{ item.app }}</strong><small>{{ item.id }}</small></span><time>{{ formatTime(item.startedAt) }}</time><StatusBadge :label="item.status" /></button>
        </div>
        <div v-else class="overview-activity-empty"><AppIcon name="experience" :size="23" /><strong>暂无体验记录</strong><p>完成在线体验后，最近状态会显示在这里。</p></div>
      </section>
      <section class="overview-activity-panel">
        <header><h3>最近 API 任务</h3><button class="text-button" @click="navigate('/api/tasks')">查看全部<AppIcon name="arrow" :size="14" /></button></header>
        <p v-if="loading" class="overview-activity-state">正在加载 API 任务…</p>
        <div v-else-if="!error && tasks.length" class="dashboard-list">
          <button v-for="task in tasks" :key="task.id" @click="navigate('/api/tasks')"><span class="list-emblem"><AppIcon name="tasks" :size="17" /></span><span class="list-copy"><strong>{{ task.model }}</strong><small>{{ task.id }}</small></span><time>{{ task.created || "—" }}</time><StatusBadge :label="task.status" /></button>
        </div>
        <div v-else class="overview-activity-empty"><AppIcon name="tasks" :size="23" /><strong>暂无 API 任务</strong><p>实际状态、时间与计费以网关记录为准。</p></div>
      </section>
    </div>
  </div>
</template>
