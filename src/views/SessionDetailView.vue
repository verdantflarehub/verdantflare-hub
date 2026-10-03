<script setup>
import { computed, ref, watch } from "vue";
import { controlApi } from "../api/control";
import AppIcon from "../components/AppIcon.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { navigate } from "../router";

const props = defineProps({ path: String });
const emit = defineEmits(["toast"]);
const sessionId = computed(() => props.path.split("/").filter(Boolean).at(-1));
const session = ref(null);
const loading = ref(true);
const error = ref("");
const formatTime = (value) => value ? new Date(value).toLocaleString("zh-CN") : "—";

const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    const sessions = await controlApi.listExperienceSessions();
    session.value = sessions.find((item) => item.id === sessionId.value) || null;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Session 加载失败";
  } finally {
    loading.value = false;
  }
};
watch(sessionId, load, { immediate: true });

const closeSession = async () => {
  try {
    await controlApi.closeExperienceSession(sessionId.value);
    await load();
    emit("toast", "Session 记录已关闭");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "关闭 Session 失败";
  }
};
</script>

<template>
  <div v-if="loading" class="page"><p>正在加载 Session…</p></div>
  <div v-else-if="error" class="page"><section class="ops-note"><AppIcon name="warning" :size="19" /><div><strong>Session 操作失败</strong><p>{{ error }}</p></div><button class="button secondary" @click="load">重新加载</button></section></div>
  <div v-else-if="session" class="page detail-workspace-page">
    <button class="back-button" @click="navigate('/experience')"><AppIcon name="arrow" :size="16" />返回体验中心</button>
    <section class="detail-command-bar">
      <div>
        <span class="page-overline">EXPERIENCE SESSION</span>
        <h1>{{ session.app }}</h1>
        <p><code>{{ session.id }}</code> · {{ session.region }} · {{ formatTime(session.startedAt) }} 启动</p>
      </div>
      <div class="detail-command-actions">
        <StatusBadge label="待核验" />
        <button class="button secondary" disabled>工作区尚未接入<AppIcon name="external" :size="15" /></button>
        <button v-if="session.status === '运行中'" class="button danger" @click="closeSession">关闭记录</button>
      </div>
    </section>

    <div class="detail-two-column">
      <section class="content-panel">
        <div class="section-heading"><div><h2>会话记录</h2><p>仅展示 Control 保存的记录，未核实运行资源或实际清理。</p></div></div>
        <ol class="session-timeline"><li class="done"><span /><div><strong>Session 记录创建</strong><small>{{ formatTime(session.startedAt) }} · {{ session.region }}</small></div><time>已记录</time></li><li v-if="session.closedAt" class="done"><span /><div><strong>记录关闭</strong><small>{{ formatTime(session.closedAt) }}</small></div><time>已记录</time></li></ol>
      </section>

      <aside class="content-panel session-facts">
        <div class="section-heading"><div><h2>记录字段</h2><p>以下值未经运行系统核验，不代表实际用量。</p></div></div>
        <dl>
          <div><dt>剩余时间</dt><dd>未核验</dd></div>
          <div><dt>当前用量</dt><dd>未核验</dd></div>
          <div><dt>区域</dt><dd>{{ session.region }}</dd></div>
          <div><dt>到期时间</dt><dd>{{ formatTime(session.expiresAt) }}</dd></div>
          <div><dt>清理状态</dt><dd>未核验</dd></div>
        </dl>
      </aside>
    </div>

    <section class="content-panel session-results">
      <div class="section-heading"><div><h2>任务与临时结果</h2><p>任务结果接口尚未接入；此处不会显示模拟内容。</p></div></div>
      <div class="prototype-empty-inline"><AppIcon name="playground" :size="24" /><div><strong>任务执行尚未接入</strong><span>当前不会运行应用，也没有可预览的体验结果。</span></div></div>
    </section>
  </div>

  <div v-else-if="!loading && !error" class="page"><button class="back-button" @click="navigate('/experience')"><AppIcon name="arrow" :size="16" />返回体验中心</button><section class="empty-state"><AppIcon name="warning" :size="28" /><strong>Session 不存在或已不可见</strong><span>{{ sessionId }} 可能已清理，或不属于当前组织。</span></section></div>
</template>
