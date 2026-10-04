<script setup>
import { onMounted, ref } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import MetricCard from "../components/MetricCard.vue";
import ModelExperiencePanel from "../components/ModelExperiencePanel.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";

const sessions = ref([]);
const sessionsError = ref("");
const sessionsLoading = ref(false);
const props = defineProps({ organization: Object });

const formatStartedAt = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || "—" : date.toLocaleString("zh-CN");
};

const loadSessions = async () => {
  sessionsLoading.value = true;
  sessionsError.value = "";
  try {
    sessions.value = (await controlApi.listExperienceSessions()) || [];
  } catch (cause) {
    sessionsError.value = cause instanceof Error ? cause.message : "Session 加载失败";
  } finally {
    sessionsLoading.value = false;
  }
};

onMounted(loadSessions);
</script>

<template>
  <div class="page experience-page">
    <header class="page-header">
      <div><span class="page-overline">EXPERIENCE CENTER</span><h1>在线体验</h1><p>模型体验使用真实网关与组织额度；应用运行环境仍待接入。</p></div>
      <button class="button secondary" :disabled="sessionsLoading" @click="loadSessions"><AppIcon name="check" :size="17" />刷新 Session</button>
    </header>

    <section class="metric-grid compact">
      <MetricCard label="模型体验" value="DeepSeek Flash" detail="真实调用；按组织 API 额度计费" icon="models" tone="mint" />
      <MetricCard label="应用运行环境" value="未核验" detail="资源调度待接入" icon="playground" tone="blue" />
      <MetricCard label="应用 Session 记录" :value="String(sessions.length)" detail="当前组织" icon="usage" tone="violet" />
    </section>

    <ModelExperiencePanel :organization-id="props.organization?.organizationId" />

    <section v-if="sessionsError" class="security-callout"><AppIcon name="warning" :size="22" /><div><strong>Session 操作未完成</strong><p>{{ sessionsError }}</p></div><button class="button secondary" @click="loadSessions">重新加载</button></section>
    <p v-if="sessionsLoading">正在加载 Session 记录…</p>

    <section>
      <div class="section-heading"><div><h2>应用 Session 记录</h2><p>仅为数据库记录，运行与用量状态尚无资源系统核验。</p></div></div>
      <div v-if="sessions.length" class="data-table session-table">
        <div class="table-head"><span>Session / 应用</span><span>区域</span><span>启动时间</span><span>时长 / 清理</span><span>用量</span><span>状态</span><span /></div>
        <div v-for="session in sessions" :key="session.id" class="table-row">
          <span><strong>{{ session.app }}</strong><small>{{ session.id }}</small></span><span>{{ session.region }}</span><span>{{ formatStartedAt(session.startedAt) }}</span><span>未核验</span><span>未核验</span><StatusBadge label="待核验" /><button class="row-action" :aria-label="`查看 ${session.app} 会话`" @click="navigate(`/experience/sessions/${session.id}`)"><AppIcon name="arrow" :size="15" /></button>
        </div>
      </div>
      <div v-else-if="!sessionsLoading && !sessionsError" class="empty-state"><AppIcon name="experience" :size="28" /><strong>暂无 Session 记录</strong><span>在线体验开放后，此处才会显示实际任务记录。</span></div>
    </section>

    <section class="safety-note"><AppIcon name="warning" :size="19" /><div><strong>应用云端体验尚未开放</strong><p>尚未接入工作区、资源调度与结果回传；已有应用 Session 仅为历史记录，不代表当前有运行中的计算资源。</p></div></section>
  </div>
</template>
