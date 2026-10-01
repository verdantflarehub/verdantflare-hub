<script setup>
import { computed, ref } from "vue";
import AppIcon from "../components/AppIcon.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { apps, releases } from "../data/mock";
import { navigate } from "../router";

const props = defineProps({ path: String });
const emit = defineEmits(["toast"]);
const appId = computed(() => props.path.split("/").filter(Boolean)[2]);
const app = computed(() => apps.find((item) => item.id === appId.value));
const release = computed(() => releases.find((item) => item.app === app.value?.name));
const channel = ref(release.value?.channel || "Candidate");
const audience = ref(release.value?.audience || "内部");

const saveDraft = () => emit("toast", "发布草稿已在原型中保存");
</script>

<template>
  <div v-if="app" class="page detail-workspace-page">
    <button class="back-button" @click="navigate('/ops/apps')"><AppIcon name="arrow" :size="16" />返回应用发布</button>
    <section class="detail-command-bar internal-detail">
      <div class="app-large-icon" :class="app.tone"><AppIcon :name="app.icon" :size="31" /></div>
      <div class="detail-title-copy"><span class="page-overline internal-overline">APP RELEASE</span><h1>{{ app.name }} · {{ app.version }}</h1><p>检查 Manifest、标准验证、发布通道和客户范围。</p></div>
      <div class="detail-command-actions"><StatusBadge :label="release?.status || '候选'" /><button class="button secondary" @click="saveDraft">保存草稿</button><button class="button primary" @click="$emit('toast', '发布评审已发起')">提交评审</button></div>
    </section>

    <section class="release-stage-line" aria-label="发布阶段">
      <div class="done"><span>1</span><strong>Candidate</strong></div><i /><div class="active"><span>2</span><strong>Manifest & 验证</strong></div><i /><div><span>3</span><strong>Preview</strong></div><i /><div><span>4</span><strong>Stable</strong></div><i /><div><span>5</span><strong>暂停 / 回滚</strong></div>
    </section>

    <div class="detail-two-column release-detail-grid">
      <section class="content-panel manifest-panel">
        <div class="section-heading"><div><h2>AppManifest</h2><p>版本、运行环境、模型和依赖的可审阅摘要。</p></div><code>schema v0.1</code></div>
        <div class="manifest-fields">
          <div><span>应用标识</span><strong>{{ app.id }}</strong></div><div><span>应用版本</span><strong>{{ app.version }}</strong></div>
          <div><span>运行时</span><strong>Station Runtime ≥ 0.2</strong></div><div><span>入口协议</span><strong>MCP + Dashboard</strong></div>
          <div><span>推荐 GPU</span><strong>{{ app.gpu }}</strong></div><div><span>数据目录</span><strong>/data/apps/{{ app.id }}</strong></div>
        </div>
        <div class="manifest-block"><span>模型与依赖</span><ul><li>{{ app.category === '视频生成' ? 'SD2 Video Runtime · locked' : 'Workflow Runtime · locked' }}</li><li>CUDA 12.4 · Driver ≥ 550</li><li>Artifact output contract v0.1</li></ul></div>
      </section>

      <aside class="content-panel release-controls">
        <div class="section-heading"><div><h2>发布范围</h2><p>保存后仍需服务端角色与权益校验。</p></div></div>
        <label class="form-field"><span>发布通道</span><select v-model="channel"><option>Candidate</option><option>Experimental</option><option>Preview</option><option>Stable</option></select></label>
        <label class="form-field"><span>客户范围</span><select v-model="audience"><option>内部</option><option>3 个试用组织</option><option>12 个授权组织</option><option>全部符合套餐的组织</option></select></label>
        <div class="release-warning"><AppIcon name="warning" :size="18" /><span>切换 Stable 前必须完成许可、安全、安装、健康检查、任务和 Artifact 六项验证。</span></div>
      </aside>
    </div>

    <section class="content-panel validation-panel">
      <div class="section-heading"><div><h2>标准验证</h2><p>同一版本必须在声明的 Station 组合上留下可追踪结果。</p></div><strong>{{ release?.validation || '0 / 6' }}</strong></div>
      <div class="validation-grid"><div v-for="item in ['许可与来源','镜像与签名','安装与升级','健康检查','最小任务','Artifact 输出']" :key="item"><AppIcon :name="['许可与来源','镜像与签名'].includes(item) ? 'check' : 'warning'" :size="17" /><span><strong>{{ item }}</strong><small>{{ ['许可与来源','镜像与签名'].includes(item) ? '已通过' : '等待验证' }}</small></span></div></div>
    </section>
  </div>
  <div v-else class="page"><button class="back-button" @click="navigate('/ops/apps')"><AppIcon name="arrow" :size="16" />返回应用发布</button><section class="empty-state"><AppIcon name="warning" :size="28" /><strong>找不到应用发布记录</strong><span>{{ appId }} 尚未收录，或当前角色无权查看。</span></section></div>
</template>
