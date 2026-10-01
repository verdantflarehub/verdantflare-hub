<script setup>
import { computed, ref } from "vue";
import AppIcon from "../components/AppIcon.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { experienceSessions } from "../data/mock";
import { navigate } from "../router";

const props = defineProps({ path: String });
const emit = defineEmits(["toast"]);
const sessionId = computed(() => props.path.split("/").filter(Boolean).at(-1));
const source = computed(() => experienceSessions.find((item) => item.id === sessionId.value));
const session = ref(source.value ? structuredClone(source.value) : null);

const closeSession = () => {
  session.value.status = "清理中";
  session.value.remaining = "正在释放资源";
  emit("toast", "Session 已关闭，资源与临时数据进入清理队列");
};
</script>

<template>
  <div v-if="session" class="page detail-workspace-page">
    <button class="back-button" @click="navigate('/experience')"><AppIcon name="arrow" :size="16" />返回体验中心</button>
    <section class="detail-command-bar">
      <div>
        <span class="page-overline">EXPERIENCE SESSION</span>
        <h1>{{ session.app }}</h1>
        <p><code>{{ session.id }}</code> · {{ session.region }} · {{ session.startedAt }} 启动</p>
      </div>
      <div class="detail-command-actions">
        <StatusBadge :label="session.status" />
        <button class="button secondary" @click="$emit('toast', '工作区入口将在体验运行时接入后启用')">打开工作区<AppIcon name="external" :size="15" /></button>
        <button v-if="session.status === '运行中'" class="button danger" @click="closeSession">关闭 Session</button>
      </div>
    </section>

    <div class="detail-two-column">
      <section class="content-panel">
        <div class="section-heading"><div><h2>会话生命周期</h2><p>从权益检查到资源释放的完整状态。</p></div></div>
        <ol class="session-timeline">
          <li class="done"><span /><div><strong>权益与额度检查</strong><small>组织权益 v12 · 体验额度充足</small></div><time>14:25</time></li>
          <li class="done"><span /><div><strong>资源分配完成</strong><small>L40S · 24 GB · cn-east-1</small></div><time>14:26</time></li>
          <li :class="session.status === '运行中' ? 'active' : 'done'"><span /><div><strong>体验工作区</strong><small>临时输入、任务与结果仅属于本 Session</small></div><time>{{ session.status }}</time></li>
          <li :class="session.status === '清理中' ? 'active' : ''"><span /><div><strong>关闭与自动清理</strong><small>释放计算资源并删除临时数据</small></div><time>{{ session.remaining }}</time></li>
        </ol>
      </section>

      <aside class="content-panel session-facts">
        <div class="section-heading"><div><h2>资源与限制</h2><p>当前 Session 的受控运行边界。</p></div></div>
        <dl>
          <div><dt>剩余时间</dt><dd>{{ session.remaining }}</dd></div>
          <div><dt>当前用量</dt><dd>{{ session.usage }}</dd></div>
          <div><dt>资源规格</dt><dd>L40S · 24 GB</dd></div>
          <div><dt>结果保留</dt><dd>关闭后 24 小时</dd></div>
          <div><dt>项目写入</dt><dd>默认禁止</dd></div>
        </dl>
      </aside>
    </div>

    <section class="content-panel session-results">
      <div class="section-heading"><div><h2>任务与临时结果</h2><p>体验结果可预览或下载，不会自动写入 Studio 项目。</p></div><button class="text-button" @click="$emit('toast', '结果列表已刷新')">刷新</button></div>
      <div class="prototype-empty-inline"><AppIcon name="playground" :size="24" /><div><strong>尚未产生任务结果</strong><span>进入工作区并完成一次最小操作后，任务状态与预览会显示在这里。</span></div></div>
    </section>
  </div>

  <div v-else class="page"><button class="back-button" @click="navigate('/experience')"><AppIcon name="arrow" :size="16" />返回体验中心</button><section class="empty-state"><AppIcon name="warning" :size="28" /><strong>Session 不存在或已不可见</strong><span>{{ sessionId }} 可能已清理，或不属于当前组织。</span></section></div>
</template>
